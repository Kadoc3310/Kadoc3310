const config = {
    type: Phaser.CANVAS, // Force Canvas renderer to avoid WebGL issues in headless browser
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let platforms;
let player1;
let player2;
let keys;
let gameState = {};
let turnText;
let moveTimer;
let seeds;
let aimingLine;
let player1HealthText;
let player2HealthText;
let boosts;

const game = new Phaser.Game(config);

function preload() {
    const graphics = this.make.graphics({ add: false });
    graphics.fillStyle(0x228B22).fillRect(0, 0, 1, 1).generateTexture('ground', 1, 1);
    graphics.fillStyle(0xff4500).fillRect(0, 0, 32, 48).generateTexture('player_body', 32, 48);
    graphics.fillStyle(0xffffff, 0.5).fillRect(0, 0, 10, 48).generateTexture('player_front', 10, 48);
    graphics.fillStyle(0xFFFF00).fillCircle(4, 4, 4).generateTexture('seed', 8, 8);

    // Boost item texture (a simple gold square)
    graphics.fillStyle(0xFFD700); // Gold color
    graphics.fillRect(0, 0, 24, 24);
    graphics.generateTexture('boost', 24, 24);

    graphics.destroy();
}

function create() {
    this.cameras.main.setBackgroundColor('#87CEEB');
    platforms = this.physics.add.staticGroup();
    platforms.create(config.width / 2, config.height - 20, 'ground').setDisplaySize(config.width, 40).refreshBody();
    platforms.create(600, 550, 'ground').setDisplaySize(300, 30).refreshBody();
    platforms.create(150, 400, 'ground').setDisplaySize(200, 30).refreshBody();
    platforms.create(1050, 320, 'ground').setDisplaySize(250, 30).refreshBody();

    player1 = setupPlayer(this, 200, 300, 'Player 1', 'right');
    player2 = setupPlayer(this, 1000, 200, 'Player 2', 'left', 0xadd8e6);

    this.physics.add.collider(player1, platforms);
    this.physics.add.collider(player2, platforms);

    seeds = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 10 });
    this.physics.add.collider(seeds, platforms, (seed) => seed.destroy());
    this.physics.add.collider(seeds, player1, handleSeedHit);
    this.physics.add.collider(seeds, player2, handleSeedHit);

    // Create and place boost items
    boosts = this.physics.add.staticGroup();
    boosts.create(600, 520, 'boost');
    boosts.create(150, 370, 'boost');
    this.physics.add.overlap(player1, boosts, collectBoost);
    this.physics.add.overlap(player2, boosts, collectBoost);

    turnText = this.add.text(16, 16, '', { fontSize: '24px', fill: '#fff' });
    player1HealthText = this.add.text(16, 50, '', { fontSize: '18px', fill: '#fff' });
    player2HealthText = this.add.text(config.width - 200, 50, '', { fontSize: '18px', fill: '#fff' });
    updateStatusText();

    keys = this.input.keyboard.addKeys('A,D,SPACE');
    aimingLine = this.add.graphics({ lineStyle: { width: 2, color: 0xff0000 } });

    this.input.on('pointerdown', fireSeed, this);

    startTurn(this, player1, player2);
}

function update() {
    if (gameState.turnPhase === 'game_over') return;

    aimingLine.clear();
    if (gameState.turnPhase === 'move') {
        handlePlayerMovement();
        if (Phaser.Input.Keyboard.JustDown(keys.SPACE)) {
            endMovePhase(this);
        }
    } else if (gameState.turnPhase === 'action') {
        drawAimingLine(this.input.activePointer);
    }
}

// --- Helper Functions ---

function drawAimingLine(pointer) {
    const startPoint = new Phaser.Math.Vector2(gameState.currentPlayer.x, gameState.currentPlayer.y);
    const endPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    aimingLine.clear();
    aimingLine.lineBetween(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
}

function fireSeed(pointer) {
    if (gameState.turnPhase !== 'action') return;

    const seed = seeds.get(gameState.currentPlayer.x, gameState.currentPlayer.y, 'seed');
    if (seed) {
        seed.setActive(true).setVisible(true);
        this.physics.moveTo(seed, pointer.worldX, pointer.worldY, 500);
        seed.body.setCollideWorldBounds(true);
        seed.body.onWorldBounds = true;
        seed.body.world.on('worldbounds', (body) => {
            if (body.gameObject === seed) {
                seed.destroy();
            }
        });
    }

    // Use a short delay before switching turns to let the shot travel
    this.time.delayedCall(500, () => switchTurn(this));
}

function handleSeedHit(player, seed) {
    if (player === gameState.otherPlayer) {
        const attacker = gameState.currentPlayer;
        const hitFromLeft = seed.body.velocity.x > 0;
        let damage = 20; // Base damage

        // Apply boost if the attacker has one
        if (attacker.hasBoost) {
            damage *= 2; // Double damage boost
            attacker.hasBoost = false;
        }

        // Apply back-hit multiplier
        if ((player.facing === 'left' && hitFromLeft) || (player.facing === 'right' && !hitFromLeft)) {
            damage *= 1.5; // Back-hit
        }

        player.health -= damage;
        updateStatusText();

        if (player.health <= 0) {
            endGame(gameState.currentPlayer, player);
        }
    }
    seed.destroy();
}

function collectBoost(player, boost) {
    if (player.hasBoost || player !== gameState.currentPlayer) return; // Can only collect on your turn and if you don't have one

    boost.disableBody(true, true); // Hide and disable the boost
    player.hasBoost = true;
    updateStatusText();
}

function setupPlayer(scene, x, y, name, facing, tint) {
    const player = scene.physics.add.sprite(x, y, 'player_body');
    player.setBounce(0.1);
    player.setCollideWorldBounds(true);
    player.playerName = name;
    player.facing = facing;
    player.health = 100;
    player.hasBoost = false; // Initialize boost status
    if (tint) {
        player.setTint(tint);
    }
    const frontIndicator = scene.add.sprite(facing === 'right' ? 8 : -8, 0, 'player_front');
    player.add(frontIndicator);
    return player;
}

function startTurn(scene, currentPlayer, otherPlayer) {
    gameState.currentPlayer = currentPlayer;
    gameState.otherPlayer = otherPlayer;
    gameState.turnPhase = 'move';
    turnText.setText(`${currentPlayer.playerName}'s Turn - Move Phase`);
    moveTimer = scene.time.delayedCall(3000, () => endMovePhase(scene));
}

function endMovePhase(scene) {
    if (gameState.turnPhase !== 'move') return;
    moveTimer.remove();
    gameState.turnPhase = 'action';
    turnText.setText(`${gameState.currentPlayer.playerName}'s Turn - Action Phase`);
    gameState.currentPlayer.setVelocityX(0);
}

function switchTurn(scene) {
    if (gameState.turnPhase === 'game_over') return;
    const lastPlayer = gameState.currentPlayer;
    startTurn(scene, gameState.otherPlayer, lastPlayer);
}

function handlePlayerMovement() {
    gameState.currentPlayer.setVelocityX(0);
    if (keys.A.isDown) {
        gameState.currentPlayer.setVelocityX(-160);
    } else if (keys.D.isDown) {
        gameState.currentPlayer.setVelocityX(160);
    }
}

function updateStatusText() {
    let p1Text = `Player 1 Health: ${player1.health > 0 ? player1.health : 0}`;
    if (player1.hasBoost) {
        p1Text += '\nBoost Ready!';
    }
    player1HealthText.setText(p1Text);

    let p2Text = `Player 2 Health: ${player2.health > 0 ? player2.health : 0}`;
    if (player2.hasBoost) {
        p2Text += '\nBoost Ready!';
    }
    player2HealthText.setText(p2Text);
}

function endGame(winner, loser) {
    gameState.turnPhase = 'game_over';
    turnText.setText(`${winner.playerName} wins!`);
    aimingLine.clear();
    // Make the loser transparent
    loser.setAlpha(0.5);
}