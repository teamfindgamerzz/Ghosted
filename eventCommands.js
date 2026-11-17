const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

function addEventDetails(subcommand) {
  return subcommand
    .addStringOption(o => o.setName("title").setDescription("Event title").setRequired(true).setMaxLength(256))
    .addStringOption(o => o.setName("description").setDescription("Event details").setRequired(true).setMaxLength(4000))
    .addStringOption(o => o.setName("prize").setDescription("Event prize (optional)").setMaxLength(500))
    .addStringOption(o => o.setName("date").setDescription("Event date, e.g. 25 December 2026").setMaxLength(100))
    .addStringOption(o => o.setName("time").setDescription("Event time, e.g. 8:00 PM").setMaxLength(100))
    .addStringOption(o => o.setName("timezone").setDescription("Timezone, e.g. Bangladesh Standard Time (UTC+6)").setMaxLength(100))
    .addStringOption(o => o.setName("banner").setDescription("Image URL for the event banner").setMaxLength(500))
    .addStringOption(o => o.setName("color").setDescription("Embed hex color, e.g. #5865F2").setMaxLength(7))
    .addChannelOption(o => o.setName("channel").setDescription("Where to publish the event").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addRoleOption(o => o.setName("ping_role").setDescription("Role to notify"))
    .addStringOption(o => o.setName("link_url").setDescription("Optional button URL").setMaxLength(500))
    .addStringOption(o => o.setName("link_label").setDescription("Optional button label (requires link_url)").setMaxLength(80));
}

function buildEventCommand() {
  return new SlashCommandBuilder()
    .setName("event")
    .setDescription("Create and preview event announcements")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => addEventDetails(s.setName("create").setDescription("Publish an event announcement")))
    .addSubcommand(s => addEventDetails(s.setName("preview").setDescription("Preview an event announcement privately")))
    .addSubcommand(s => s.setName("help").setDescription("Show event command help"));
}

function makeEventPayload(interaction) {
  const options = interaction.options;
  const title = options.getString("title", true);
  const description = options.getString("description", true);
  const prize = options.getString("prize");
  const date = options.getString("date");
  const time = options.getString("time");
  const timezone = options.getString("timezone");
  const banner = options.getString("banner");
  const colorInput = options.getString("color") || "#5865F2";
  const channel = options.getChannel("channel");
  const pingRole = options.getRole("ping_role");
  const linkUrl = options.getString("link_url");
  const linkLabel = options.getString("link_label") || "Join Event";

  if (!/^#[0-9A-Fa-f]{6}$/.test(colorInput)) {
    throw new Error("Invalid color. Use a six-digit hex color such as #5865F2.");
  }

  if (banner && !/^https?:\/\//i.test(banner)) {
    throw new Error("Banner must be a valid HTTP or HTTPS image URL.");
  }

  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
    throw new Error("Button URL must begin with http:// or https://.");
  }

  if (linkLabel && !linkUrl && options.getString("link_label")) {
    throw new Error("Add link_url when using link_label.");
  }

  const embed = new EmbedBuilder()
    .setColor(colorInput)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `Event hosted by ${interaction.guild.name}` })
    .setTimestamp();

  if (prize) embed.addFields({ name: "Prize", value: prize.slice(0, 1024), inline: true });
  if (date) embed.addFields({ name: "Date", value: date, inline: true });
  if (time) embed.addFields({ name: "Time", value: time, inline: true });
  if (timezone) embed.addFields({ name: "Timezone", value: timezone, inline: false });
  if (banner) embed.setImage(banner);

  const components = [];
  if (linkUrl) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(linkLabel).setStyle(ButtonStyle.Link).setURL(linkUrl)
    ));
  }

  const content = pingRole ? `<@&${pingRole.id}>` : undefined;
  return {
    channel,
    pingRole,
    message: {
      content,
      embeds: [embed],
      components,
      allowedMentions: { roles: pingRole ? [pingRole.id] : [] }
    }
  };
}

async function handleEventCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "You need Manage Server permission to use event commands.", ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "help") {
    return interaction.reply({
      content: [
        "**Ghosted Event Commands**",
        "`/event create` — Publish an event announcement.",
        "`/event preview` — Preview an event privately.",
        "`/event help` — Show this help message.",
        "",
        "Title and description are required. Prize, date, time, timezone, banner, color, channel, ping role and link button are optional."
      ].join("\n"),
      ephemeral: true
    });
  }

  const payload = makeEventPayload(interaction);

  if (subcommand === "preview") {
    return interaction.reply({ ...payload.message, ephemeral: true });
  }

  const targetChannel = payload.channel || interaction.channel;
  if (!targetChannel || !targetChannel.isTextBased() || !targetChannel.send) {
    return interaction.reply({ content: "I cannot send an event announcement to that channel.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const sent = await targetChannel.send(payload.message);
  return interaction.editReply(`Event announcement published in <#${targetChannel.id}>. Message ID: ${sent.id}`);
}

module.exports = { buildEventCommand, handleEventCommand };
