
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const commandData = new SlashCommandBuilder()
  .setName("event")
  .setDescription("Ghosted event management")

  .addSubcommand(sub =>
    sub.setName("create")
      .setDescription("Create an event announcement")
      .addStringOption(o =>
        o.setName("title")
          .setDescription("Event title")
          .setRequired(true))
      .addStringOption(o =>
        o.setName("description")
          .setDescription("Event description")
          .setRequired(true))
      .addStringOption(o =>
        o.setName("prize")
          .setDescription("Event prize"))
      .addStringOption(o =>
        o.setName("date")
          .setDescription("Event date"))
      .addStringOption(o =>
        o.setName("time")
          .setDescription("Event time"))
      .addStringOption(o =>
        o.setName("timezone")
          .setDescription("Example: Asia/Dhaka"))
      .addStringOption(o =>
        o.setName("banner")
          .setDescription("Banner image URL"))
      .addStringOption(o =>
        o.setName("color")
          .setDescription("Hex color, e.g. #5865F2"))
      .addChannelOption(o =>
        o.setName("channel")
          .setDescription("Announcement channel")
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement
          ))
      .addRoleOption(o =>
        o.setName("ping_role")
          .setDescription("Role to mention"))
      .addStringOption(o =>
        o.setName("button_label")
          .setDescription("Button label"))
      .addStringOption(o =>
        o.setName("button_url")
          .setDescription("Button destination URL"))
  )

  .addSubcommand(sub =>
    sub.setName("preview")
      .setDescription("Preview an event announcement")
      .addStringOption(o =>
        o.setName("title")
          .setDescription("Event title")
          .setRequired(true))
      .addStringOption(o =>
        o.setName("description")
          .setDescription("Event description")
          .setRequired(true))
      .addStringOption(o =>
        o.setName("prize")
          .setDescription("Event prize"))
      .addStringOption(o =>
        o.setName("date")
          .setDescription("Event date"))
      .addStringOption(o =>
        o.setName("time")
          .setDescription("Event time"))
      .addStringOption(o =>
        o.setName("timezone")
          .setDescription("Example: Asia/Dhaka"))
      .addStringOption(o =>
        o.setName("banner")
          .setDescription("Banner image URL"))
      .addStringOption(o =>
        o.setName("color")
          .setDescription("Hex color"))
      .addStringOption(o =>
        o.setName("button_label")
          .setDescription("Button label"))
      .addStringOption(o =>
        o.setName("button_url")
          .setDescription("Button destination URL"))
  )

  .addSubcommand(sub =>
    sub.setName("help")
      .setDescription("Show event command help")
  );

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function buildEvent(interaction) {
  const options = interaction.options;

  const title = options.getString("title");
  const description = options.getString("description");
  const prize = options.getString("prize");
  const date = options.getString("date");
  const time = options.getString("time");
  const timezone = options.getString("timezone") || "UTC";
  const banner = options.getString("banner");
  const color = options.getString("color") || "#5865F2";
  const buttonLabel =
    options.getString("button_label") || "Submit Entry";
  const buttonUrl = options.getString("button_url");

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error("Use a valid hex color, e.g. #5865F2.");
  }

  if (banner && !validUrl(banner)) {
    throw new Error("Banner must be a valid HTTP or HTTPS URL.");
  }

  if (buttonUrl && !validUrl(buttonUrl)) {
    throw new Error("Button URL must be a valid HTTP or HTTPS URL.");
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "Ghosted Bot • Event Management"
    })
    .setTimestamp();

  if (prize) {
    embed.addFields({
      name: "🏆 EVENT PRIZE",
      value: prize
    });
  }

  if (date || time) {
    embed.addFields({
      name: "📅 EVENT SCHEDULE",
      value: [
        date ? `**Date:** ${date}` : null,
        time ? `**Time:** ${time}` : null,
        `**Timezone:** ${timezone}`
      ].filter(Boolean).join("\n")
    });
  }

  if (banner) {
    embed.setImage(banner);
  }

  const components = [];

  if (buttonUrl) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(buttonLabel.slice(0, 80))
          .setStyle(ButtonStyle.Link)
          .setURL(buttonUrl)
      )
    );
  }

  return { embed, components };
}

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "help") {
    return interaction.reply({
      content:
        "**Ghosted Event Commands**\n\n" +
        "`/event create` — Publish an event.\n" +
        "`/event preview` — Preview an event.\n" +
        "`/event help` — Show help.",
      ephemeral: true
    });
  }

  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    ) &&
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    )
  ) {
    return interaction.reply({
      content: "You need Administrator or Manage Server permission.",
      ephemeral: true
    });
  }

  try {
    const { embed, components } = buildEvent(interaction);

    if (subcommand === "preview") {
      return interaction.reply({
        embeds: [embed],
        components,
        ephemeral: true
      });
    }

    if (subcommand === "create") {
      const channel =
        interaction.options.getChannel("channel") ||
        interaction.channel;

      if (!channel?.isTextBased() || !channel.send) {
        return interaction.reply({
          content: "Invalid announcement channel.",
          ephemeral: true
        });
      }

      const botMember = interaction.guild.members.me;

      const permissions = channel.permissionsFor(botMember);

      if (!permissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
      ])) {
        return interaction.reply({
          content: "I lack permission to send embeds in that channel.",
          ephemeral: true
        });
      }

      const role = interaction.options.getRole("ping_role");

      if (
        role &&
        !permissions.has(PermissionFlagsBits.MentionEveryone)
      ) {
        return interaction.reply({
          content: "I need Mention Everyone permission to ping that role.",
          ephemeral: true
        });
      }

      await channel.send({
        content: role ? `<@&${role.id}>` : undefined,
        embeds: [embed],
        components,
        allowedMentions: {
          parse: [],
          roles: role ? [role.id] : []
        }
      });

      return interaction.reply({
        content: `Event successfully published in ${channel}!`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error("Event command error:", error);

    const response = {
      content: `Event error: ${error.message}`,
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(response);
    }

    return interaction.reply(response);
  }
}

module.exports = {
  commandData,
  execute
};

