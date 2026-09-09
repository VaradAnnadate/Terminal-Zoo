import { select } from '@inquirer/prompts';
import chalk from 'chalk';

// Mock species catalog
const SPECIES = [
    {
        id: 'dodo',
        name: 'Dodo',
        scientific: 'Raphus cucullatus',
        status: 'Extinct',
        category: 'Fauna',
        color: chalk.redBright
    },
    {
        id: 'bengal_tiger',
        name: 'Bengal Tiger',
        scientific: 'Panthera tigris tigris',
        status: 'Endangered',
        category: 'Fauna',
        color: chalk.yellowBright
    },
    {
        id: 'silphium',
        name: 'Silphium',
        scientific: 'Ferula historica',
        status: 'Extinct',
        category: 'Flora',
        color: chalk.magentaBright
    },
    {
        id: 'blue_whale',
        name: 'Blue Whale',
        scientific: 'Balaenoptera musculus',
        status: 'Endangered',
        category: 'Fauna',
        color: chalk.cyanBright
    }
];

function printHeader() {
    console.clear();
    console.log(chalk.cyan(`
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                   ${chalk.bold.white('MINISTRY OF ENVIRONMENT')}                         ║
  ║             ${chalk.bold.green('✦ VIRTUAL ECOSYSTEM & HOLOGRAPHIC ZOO ✦')}               ║
  ║                   ${chalk.gray('Smart Education Terminal v1.0')}                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
  `));
}

async function showCatalog() {
    printHeader();

    // Format list items with clean spacing and colors
    const choices = SPECIES.map((item) => {
        const badge = item.status === 'Extinct'
            ? chalk.bgRed.white.bold(` ${item.status.toUpperCase()} `)
            : chalk.bgYellow.black.bold(` ${item.status.toUpperCase()} `);

        const typeTag = chalk.gray(`[${item.category}]`);
        const displayName = item.color.bold(item.name.padEnd(16, ' '));
        const latinName = chalk.dim.italic(`(${item.scientific})`);

        return {
            name: `${typeTag} ${displayName} ${badge}  ${latinName}`,
            value: item.id
        };
    });

    choices.push({
        name: chalk.dim('─────────────────────────────────────────────\n  ') + chalk.red.bold('✖ Exit Hologram Terminal'),
        value: 'exit'
    });

    const selected = await select({
        message: chalk.bold.white('Use arrow keys ↑/↓ to navigate, [Enter] to select:\n'),
        choices: choices,
        pageSize: 8
    });

    if (selected === 'exit') {
        console.log(chalk.green('\nShutting down holographic emitter. Goodbye!\n'));
        process.exit(0);
    }

    const chosenAnimal = SPECIES.find(s => s.id === selected);
    console.log(chalk.greenBright(`\n✔ You picked: ${chosenAnimal.name}! Ready for step 2.\n`));
}

showCatalog();