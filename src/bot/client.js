import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { recordEvent } from '../util/events.js';
import { handleCommand } from './commands.js';

export const bot = new Client({ intents: [GatewayIntentBits.Guilds, ...(config.memberIntent ? [GatewayIntentBits.GuildMembers] : [])] });
bot.once(Events.ClientReady, client => logger.info({ botId: client.user.id }, 'Discord bot connected'));
bot.on(Events.GuildMemberAdd, member => {
  if (member.guild.id === config.guildId) recordEvent('member_added', { userId: member.id });
});
bot.on(Events.InteractionCreate, interaction => {
  handleCommand(interaction).catch(async error => {
    logger.error({ message: error.message }, 'Slash command failed');
    const payload = { content: 'This command could not complete. Please try again.' };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
      else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    } catch { /* The interaction may already have expired. */ }
  });
});
bot.on(Events.Error, error => logger.error({ message: error.message }, 'Discord client error'));
export async function startBot() {
  if (!config.discordEnabled) return;
  try { await bot.login(config.botToken); }
  catch (error) { logger.error({ message: error.message }, 'Bot login failed; HTTP server remains available'); }
}
