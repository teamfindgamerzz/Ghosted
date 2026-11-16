
require("dotenv").config();

const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ]
});

const warningsFile = "./warnings.json";

function loadWarnings() {
  try {
    return JSON.parse(fs.readFileSync(warningsFile, "utf8"));
  } catch {
    return {};
  }
}

function saveWarnings(data) {
  fs.writeFileSync(warningsFile, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  new SlashCommandBuilder().setName("unban").setDescription("Unban a user")
    .addStringOption(o => o.setName("userid").setDescription("User ID").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  new SlashCommandBuilder().setName("unban-all").setDescription("Unban all banned users")
    .addBooleanOption(o => o.setName("confirm").setDescription("Confirm all unbans").setRequired(true)),

  new SlashCommandBuilder().setName("kick").setDescription("Kick a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  new SlashCommandBuilder().setName("untimeout").setDescription("Remove a timeout")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)),

  new SlashCommandBuilder().setName("warn").setDescription("Warn a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnings").setDescription("View member warnings")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)),

  new SlashCommandBuilder().setName("clear-warnings").setDescription("Clear member warnings")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)),

  new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages")
    .addIntegerOption(o => o.setName("amount").setDescription("1 to 100").setRequired(true).setMinValue(1).setMaxValue(100)),

  new SlashCommandBuilder().setName("lock").setDescription("Lock this channel"),
  new SlashCommandBuilder().setName("unlock").setDescription("Unlock this channel"),
  new SlashCommandBuilder().setName("lockdown").setDescription("Lock all text channels"),
  new SlashCommandBuilder().setName("unlockdown").setDescription("Unlock all text channels"),

  new SlashCommandBuilder().setName("slowmode").setDescription("Set channel slowmode")
    .addIntegerOption(o => o.setName("seconds").setDescription("0 to 21600 seconds").setRequired(true).setMinValue(0).setMaxValue(21600)),

  new SlashCommandBuilder().setName("hide").setDescription("Hide this channel"),
  new SlashCommandBuilder().setName("unhide").setDescription("Show this channel"),

  new SlashCommandBuilder().setName("mute").setDescription("Mute a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration").setRequired(true).setMinValue(1).setMaxValue(40320)),

  new SlashCommandBuilder().setName("unmute").setDescription("Unmute a member")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)),

  new SlashCommandBuilder().setName("nickname").setDescription("Change a member nickname")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("name").setDescription("New nickname").setRequired(true)),

  new SlashCommandBuilder().setName("history").setDescription("View recent moderation actions")
    .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
].map(c => c.toJSON());

const adminCommands = new Set(commands.map(c => c.name));

client.once("ready", () => {
  console.log(`Ghosted online as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) return;

  const { commandName, guild, member, options, channel } = interaction;

  if (!member.permissions.has(PermissionFlagsBits.ModerateMembers) &&
      !member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "You need the Moderate Members permission to use moderation commands.",
      ephemeral: true
    });
  }

  const botMember = guild.members.me;
  const reply = content => interaction.reply({ content, ephemeral: true });

  try {
    const user = options.getUser("user");
    const target = user ? await guild.members.fetch(user.id).catch(() => null) : null;
    const reason = options.getString("reason") || "No reason provided";

    if (["ban", "kick", "timeout", "untimeout", "warn", "warnings",
         "clear-warnings", "mute", "unmute", "nickname"].includes(commandName) && !target) {
      return reply("That member is not in this server.");
    }

    if (target && (target.id === interaction.user.id || target.id === client.user.id)) {
      return reply("You cannot use this command on yourself or the bot.");
    }

    if (target && target.roles.highest.position >= botMember.roles.highest.position &&
        guild.ownerId !== client.user.id) {
      return reply("My highest role must be above the target's highest role.");
    }

    switch (commandName) {
      case "ban":
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return reply("You need Ban Members permission.");
        if (!target.bannable) return reply("I cannot ban this member. Check my role position and permissions.");
        await target.ban({ reason });
        return reply(`Banned **${user.tag}**. Reason: ${reason}`);

      case "unban": {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return reply("You need Ban Members permission.");
        const id = options.getString("userid");
        await guild.members.unban(id, options.getString("reason") || "Unbanned by moderator");
        return reply(`Unbanned user ID: ${id}`);
      }

      case "unban-all": {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return reply("Administrator permission required.");
        if (!options.getBoolean("confirm")) return reply("Confirmation required.");
        const bans = await guild.bans.fetch();
        for (const ban of bans.values()) {
          await guild.members.unban(ban.user.id, "Bulk unban by server administrator");
        }
        return reply(`Unbanned ${bans.size} users.`);
      }

      case "kick":
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) return reply("You need Kick Members permission.");
        if (!target.kickable) return reply("I cannot kick this member.");
        await target.kick(reason);
        return reply(`Kicked **${user.tag}**. Reason: ${reason}`);

      case "timeout":
      case "mute": {
        const minutes = options.getInteger("minutes");
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return reply("Moderate Members permission required.");
        await target.timeout(minutes * 60000, reason);
        return reply(`Timed out **${user.tag}** for ${minutes} minutes.`);
      }

      case "untimeout":
      case "unmute":
        await target.timeout(null, "Timeout removed by moderator");
        return reply(`Removed timeout from **${user.tag}**.`);

      case "warn": {
        const data = loadWarnings();
        const key = `${guild.id}_${user.id}`;
        data[key] ||= [];
        data[key].push({
          reason,
          moderator: interaction.user.tag,
          date: new Date().toISOString()
        });
        saveWarnings(data);
        return reply(`Warned **${user.tag}**. Reason: ${reason}`);
      }

      case "warnings": {
        const data = loadWarnings();
        const list = data[`${guild.id}_${user.id}`] || [];
        return reply(list.length
          ? list.map((w, i) => `${i + 1}. ${w.reason} — ${w.moderator}`).join("\n")
          : "This member has no saved warnings.");
      }

      case "clear-warnings": {
        const data = loadWarnings();
        delete data[`${guild.id}_${user.id}`];
        saveWarnings(data);
        return reply(`Cleared warnings for **${user.tag}**.`);
      }

      case "purge": {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return reply("Manage Messages permission required.");
        const amount = options.getInteger("amount");
        const deleted = await channel.bulkDelete(amount, true);
        return reply(`Deleted ${deleted.size} messages. Messages older than 14 days cannot be bulk deleted.`);
      }

      case "lock":
      case "unlock": {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) return reply("Manage Channels permission required.");
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: commandName === "unlock" ? null : false
        });
        return reply(`Channel ${commandName === "lock" ? "locked" : "unlocked"}.`);
      }

      case "hide":
      case "unhide": {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) return reply("Manage Channels permission required.");
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          ViewChannel: commandName === "hide" ? false : null
        });
        return reply(`Channel ${commandName === "hide" ? "hidden" : "visible"}.`);
      }

      case "slowmode": {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) return reply("Manage Channels permission required.");
        const seconds = options.getInteger("seconds");
        await channel.setRateLimitPerUser(seconds);
        return reply(`Slowmode set to ${seconds} seconds.`);
      }

      case "lockdown":
      case "unlockdown": {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return reply("Administrator permission required.");
        const locked = commandName === "lockdown";
        const channels = guild.channels.cache.filter(c =>
          c.type === ChannelType.GuildText ||
          c.type === ChannelType.GuildAnnouncement
        );
        for (const ch of channels.values()) {
          await ch.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: locked ? false : null
          }).catch(() => {});
        }
        return reply(`${locked ? "Locked" : "Unlocked"} ${channels.size} text channels.`);
      }

      case "nickname": {
        if (!member.permissions.has(PermissionFlagsBits.ManageNicknames)) return reply("Manage Nicknames permission required.");
        const name = options.getString("name");
        await target.setNickname(name, "Nickname changed by moderator");
        return reply(`Changed **${user.tag}**'s nickname.`);
      }

      case "history": {
        if (!member.permissions.has(PermissionFlagsBits.ViewAuditLog)) return reply("View Audit Log permission required.");
        const logs = await guild.fetchAuditLogs({ limit: 20 });
        const entries = logs.entries.filter(e => e.target?.id === user.id).first(10);
        return reply(entries.length
          ? entries.map(e => `${e.action} — ${e.reason || "No reason"} — ${e.createdAt.toLocaleString()}`).join("\n")
          : "No recent audit-log actions found for this member.");
      }
    }
  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Command failed. Check bot permissions, role hierarchy, and logs.", ephemeral: true });
    }
  }
});

async function start() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
    throw new Error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID environment variables.");
  }

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  await client.login(process.env.DISCORD_TOKEN);
}

start().catch(console.error);
