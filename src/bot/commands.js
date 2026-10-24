import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { publicUser, statements } from '../db.js';

export const commandData = [
  ['ping', 'Check the bot connection'], ['stats', 'Show community statistics'],
  ['download', 'Get the download page'], ['guide', 'Read the manual guide'],
  ['whoami', 'Show your BYPASSER profile'], ['invite', 'Create a temporary community invite']
].map(([name, description]) => new SlashCommandBuilder().setName(name).setDescription(description).toJSON());
export async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand() || !commandData.some(c => c.name === interaction.commandName)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let content;
  switch (interaction.commandName) {
    case 'ping': content = `Pong · ${Math.round(interaction.client.ws.ping)} ms`; break;
    case 'stats': {
      const stats = statements.stats.get();
      content = `${stats.users} users · ${stats.downloads} downloads · ${stats.joins} joins`; break;
    }
    case 'download': content = `${config.baseUrl}/#downloads`; break;
    case 'guide': content = `${config.baseUrl}/#steps`; break;
    case 'whoami': {
      const user = publicUser(statements.user.get(interaction.user.id));
      content = user ? `${user.username} · Server enrollment: ${user.joined_guild ? 'confirmed' : 'not confirmed'}` : `You haven't signed in yet: ${config.baseUrl}`;
      break;
    }
    case 'invite': {
      if (interaction.guildId !== config.guildId) { content = 'This command is only available in the configured community.'; break; }
      const channels = await interaction.guild.channels.fetch();
      const channel = channels.find(c => c?.isTextBased() && c.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite));
      content = channel ? (await channel.createInvite({ maxAge: 3600, maxUses: 10, unique: true })).url : 'No channel permits the bot to create an invite.';
      break;
    }
  }
  await interaction.editReply({ content, allowed_mentions: { parse: [] } });
}
