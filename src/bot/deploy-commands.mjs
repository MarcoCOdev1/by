import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { commandData } from './commands.js';
import { db } from '../db.js';

try {
  if (!config.discordEnabled) throw new Error('Configure DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, BOT_TOKEN and GUILD_ID first.');
  const rest = new REST({ version: '10' }).setToken(config.botToken);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commandData });
  console.log(`Registered ${commandData.length} slash commands in the configured guild.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }
