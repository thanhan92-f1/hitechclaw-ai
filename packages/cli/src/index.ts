#!/usr/bin/env node
import { pluginCreate, pluginValidate, pluginPack } from './commands/plugin.js';
import { userCreate, userRegister } from './commands/user.js';
import { docsList, docsSearch, docsAdd, docsInit } from './commands/docs.js';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

console.log('🐾 HiTechClaw CLI v2.0.0');

// Simple flag parser: --key value or --key=value
function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      if (val !== undefined) {
        flags[key] = val;
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        flags[key] = argv[++i] as string;
      } else {
        flags[key] = 'true';
      }
    }
  }
  return flags;
}

switch (command) {
  case 'plugin': {
    switch (subcommand) {
      case 'create':
        if (!args[2]) { console.error('Usage: hitechclaw plugin create <name>'); process.exit(1); }
        pluginCreate(args[2], args[3]);
        break;
      case 'validate':
        pluginValidate(args[2] ?? process.cwd());
        break;
      case 'pack':
        pluginPack(args[2] ?? process.cwd());
        break;
      default:
        console.log('Usage: hitechclaw plugin <create|validate|pack>');
    }
    break;
  }

  case 'user': {
    const flags = parseFlags(args.slice(2));
    switch (subcommand) {
      case 'create':
        await userCreate({
          name: flags['name'] ?? '',
          email: flags['email'] ?? '',
          password: flags['password'] ?? '',
          role: flags['role'],
        });
        break;
      case 'register':
        await userRegister({
          name: flags['name'] ?? '',
          email: flags['email'] ?? '',
          password: flags['password'] ?? '',
          tenantName: flags['tenant-name'] ?? '',
          tenantSlug: flags['tenant-slug'] ?? '',
        });
        break;
      default:
        console.log('Usage: hitechclaw user <create|register>');
        console.log('');
        console.log('  hitechclaw user create --name <name> --email <email> --password <pass> [--role member|admin|viewer]');
        console.log('    Add a user to the current tenant (requires HITECHCLAW_TOKEN)');
        console.log('');
        console.log('  hitechclaw user register --name <name> --email <email> --password <pass> --tenant-name <name> --tenant-slug <slug>');
        console.log('    Register a new tenant + owner account');
    }
    break;
  }

  case 'docs': {
    const flags = parseFlags(args.slice(2));
    switch (subcommand) {
      case 'init':
        docsInit();
        break;
      case 'list':
        docsList(args[2]);
        break;
      case 'search':
        if (!args[2]) { console.error('Usage: hitechclaw docs search <query>'); process.exit(1); }
        docsSearch(args.slice(2).join(' '));
        break;
      case 'add':
        if (!args[2] || !args[3]) { console.error('Usage: hitechclaw docs add <path> <title> [--tags t1,t2]'); process.exit(1); }
        docsAdd(args[2], args[3], flags['tags'] ?? '');
        break;
      default:
        console.log('Usage: hitechclaw docs <init|list|search|add>');
        console.log('');
        console.log('  hitechclaw docs init              Initialize dev-docs directory');
        console.log('  hitechclaw docs list [category]   List documentation files');
        console.log('  hitechclaw docs search <query>    Search documentation');
        console.log('  hitechclaw docs add <path> <title> [--tags t1,t2]  Add new document');
    }
    break;
  }

  default:
    console.log('Usage: hitechclaw <command>');
    console.log('Commands:');
    console.log('  plugin create <name>   Scaffold a new plugin');
    console.log('  plugin validate [dir]  Validate plugin structure');
    console.log('  plugin pack [dir]      Package plugin for distribution');
    console.log('  user create            Add a user to the current tenant');
    console.log('  user register          Register a new tenant + owner');
    console.log('  docs init              Initialize dev-docs directory');
    console.log('  docs list [category]   List documentation files');
    console.log('  docs search <query>    Search documentation');
    console.log('  docs add <path> <title> [--tags t1,t2]  Add new doc');
}
