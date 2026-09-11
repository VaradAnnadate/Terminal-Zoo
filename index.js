import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { renderHologram } from './hologram.js';

// Expanded dataset with richer ecological metadata
const SPECIES = [
    {
        id: 'dodo',
        name: 'Dodo',
        scientific: 'Raphus cucullatus',
        status: 'Extinct (c. 1662)',
        category: 'Fauna',
        biome: 'Coastal Forests & Lowlands',
        region: 'Mauritius (Indian Ocean)',
        diet: 'Frugivore (fallen fruits, seeds, bulbs)',
        threat: 'Invasive pigs/rats eating eggs, habitat clearing by Dutch sailors.',
        funFact: 'Because it evolved on an isolated predator-free island, it completely lost the ability to fly and had zero fear of humans.',
        color: chalk.redBright
    },
    {
        id: 'bengal_tiger',
        name: 'Bengal Tiger',
        scientific: 'Panthera tigris tigris',
        status: 'Endangered',
        category: 'Fauna',
        biome: 'Sundarbans Mangroves & Dry Deciduous Forests',
        region: 'Indian Subcontinent',
        diet: 'Apex Carnivore (chital, sambar, wild boar)',
        threat: 'Poaching, severe human-wildlife conflict, fragmented habitats.',
        funFact: 'No two tigers possess identical stripe patterns; forest guards use stripe photography as unique fingerprint IDs.',
        color: chalk.yellowBright
    },
    {
        id: 'silphium',
        name: 'Silphium',
        scientific: 'Ferula historica',
        status: 'Extinct (c. 1st Century CE)',
        category: 'Flora',
        biome: 'Dry Scrubland / Mediterranean Coast',
        region: 'Cyrenaica (Modern Libya)',
        diet: 'Autotroph (Photosynthetic)',
        threat: 'Extreme over-harvesting by Greek and Roman empires for food and contraception.',
        funFact: 'The seed shape of Silphium is widely considered the historical origin of the classic heart shape (♥).',
        color: chalk.magentaBright
    },
    {
        id: 'blue_whale',
        name: 'Blue Whale',
        scientific: 'Balaenoptera musculus',
        status: 'Endangered',
        category: 'Fauna',
        biome: 'Pelagic Ocean Ecosystems',
        region: 'Global Oceans (Polar to Subtropical)',
        diet: 'Planktivore (consumes up to 4 tons of krill daily)',
        threat: 'Historic commercial whaling, ship collisions, ocean noise pollution.',
        funFact: 'A blue whale’s heart weighs around 180 kg (400 lbs)—roughly the size of a small golf cart.',
        color: chalk.cyanBright
    }
];

function printHeader() {
    console.clear();
    console.log(chalk.cyan(`
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                 ${chalk.bold.white('MINISTRY OF ENVIRONMENT')}                           ║
  ║             ${chalk.bold.green('✦ VIRTUAL ECOSYSTEM & HOLOGRAPHIC ZOO ✦')}               ║
  ║                   ${chalk.gray('Smart Education Terminal v1.0')}                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
  `));
}

// Format an attribute row with aligned labels
function formatField(label, value) {
    const paddedLabel = chalk.bold.cyan(label.padEnd(16, ' '));
    return `  ${paddedLabel} │ ${value}`;
}

async function showAnimalDetails(animal) {
    console.clear();

    // Decorative card header matching the animal's color
    console.log(animal.color(`
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  HOLOGRAM DOSSIER: ${animal.name.toUpperCase().padEnd(46, ' ')}║
  ╚═══════════════════════════════════════════════════════════════════╝
  `));

    // Metadata block
    console.log(formatField('Common Name', chalk.bold.white(animal.name)));
    console.log(formatField('Scientific Name', chalk.italic(animal.scientific)));
    console.log(formatField('Category', animal.category));
    console.log(formatField('Conservation', chalk.bold.underline(animal.status)));
    console.log(formatField('Native Region', animal.region));
    console.log(formatField('Ecosystem / Biome', animal.biome));
    console.log(formatField('Trophic Role', animal.diet));
    console.log(chalk.gray('  ────────────────┼──────────────────────────────────────────────────'));
    console.log(formatField('Primary Threat', chalk.redBright(animal.threat)));

    // Field note quote box
    console.log(chalk.yellow(`\n  ┌─ [FIELD RESEARCH NOTE] ──────────────────────────────────────────┐`));
    console.log(chalk.yellow(`  │ `) + chalk.white(animal.funFact));
    console.log(chalk.yellow(`  └──────────────────────────────────────────────────────────────────┘\n`));

    // Options menu
    const action = await select({
        message: chalk.bold('Choose an action:'),
        choices: [
            {
                name: chalk.greenBright('✦ Project 3D Hologram Model'),
                value: 'hologram'
            },
            {
                name: chalk.gray('◄ Return to Ecosystem Catalog'),
                value: 'back'
            }
        ]
    });

    if (action === 'hologram') {
        console.log(chalk.magentaBright(`\n[Emitter Initializing] Ready to render ${animal.name}'s 3D wireframe mesh in Step 3!`));
        await new Promise(res => setTimeout(res, 2000)); // Quick pause to see feedback
        await renderHologram(animal.id, animal.name, animal.color);
    }
}

async function startApp() {
    while (true) {
        printHeader();

        const choices = SPECIES.map((item) => {
            const isExtinct = item.status.startsWith('Extinct');
            const badge = isExtinct
                ? chalk.bgRed.white.bold(' EXTINCT ')
                : chalk.bgYellow.black.bold(' ENDANGERED ');

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

        const selectedId = await select({
            message: chalk.bold.white('Use arrow keys ↑/↓ to navigate, [Enter] to inspect:\n'),
            choices: choices,
            pageSize: 8
        });

        if (selectedId === 'exit') {
            console.clear();
            console.log(chalk.green('\nSession ended. Holographic projection powered down.\n'));
            process.exit(0);
        }

        const chosenAnimal = SPECIES.find(s => s.id === selectedId);
        await showAnimalDetails(chosenAnimal);
    }
}

startApp();