class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // This scene will load all the assets
        console.log("Preloading assets...");
        this.load.image('apple', 'assets/apple.png');
        this.load.image('pear', 'assets/pear.png');
        this.load.image('peach', 'assets/peach.png');
        this.load.image('banana', 'assets/banana.png');
        this.load.image('seed', 'assets/seed.png');

        const graphics = this.make.graphics({ add: false });
        graphics.fillStyle(0x228B22).fillRect(0, 0, 1, 1).generateTexture('ground', 1, 1);
        graphics.fillStyle(0xffffff, 0.5).fillRect(0, 0, 10, 48).generateTexture('player_front', 10, 48);
        graphics.fillStyle(0xFFD700).fillRect(0, 0, 24, 24).generateTexture('boost', 24, 24);
        graphics.destroy();
    }

    create() {
        console.log("Preload complete, starting SelectScene.");
        this.scene.start('SelectScene');
    }
}

class SelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SelectScene' });
        this.selections = { player1: null, player2: null };
        this.currentPlayer = 1;
        this.characterSprites = [];
    }

    create() {
        this.cameras.main.setBackgroundColor('#000033');
        this.titleText = this.add.text(config.width / 2, 100, `Player ${this.currentPlayer}, Choose Your Fruit!`, { fontSize: '48px', fill: '#fff' }).setOrigin(0.5);

        const characters = ['apple', 'pear', 'peach', 'banana'];
        const positions = [200, 400, 600, 800];

        characters.forEach((char, index) => {
            const x = positions[index];
            const y = config.height / 2;
            const sprite = this.add.sprite(x, y, char).setInteractive().setScale(2);
            sprite.characterKey = char; // Store the key on the sprite

            this.characterSprites.push(sprite);

            sprite.on('pointerdown', () => {
                this.handleSelection(sprite);
            });
        });
    }

    handleSelection(selectedSprite) {
        // Prevent an already-selected character from being chosen again
        if (selectedSprite.characterKey === this.selections.player1) {
            return;
        }

        if (this.currentPlayer === 1) {
            this.selections.player1 = selectedSprite.characterKey;
            selectedSprite.setTint(0x888888); // Gray out the selected sprite
            this.currentPlayer = 2;
            this.titleText.setText(`Player ${this.currentPlayer}, Choose Your Fruit!`);
        } else if (this.currentPlayer === 2) {
            this.selections.player2 = selectedSprite.characterKey;
            selectedSprite.setTint(0x888888);

            // Disable all sprites now that selection is complete
            this.characterSprites.forEach(s => s.disableInteractive());

            // Both players have selected, start the game after a short delay
            this.time.delayedCall(1000, () => {
                this.scene.start('GameScene', this.selections);
            });
        }
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        // Receive character selections from the previous scene
        this.player1_selection = data.player1 || 'apple';
        this.player2_selection = data.player2 || 'pear';
    }

    create() {
        this.cameras.main.setBackgroundColor('#87CEEB');
        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(config.width / 2, config.height - 20, 'ground').setDisplaySize(config.width, 40).refreshBody();
        this.platforms.create(600, 550, 'ground').setDisplaySize(300, 30).refreshBody();
        this.platforms.create(150, 400, 'ground').setDisplaySize(200, 30).refreshBody();
        this.platforms.create(1050, 320, 'ground').setDisplaySize(250, 30).refreshBody();

        this.player1 = this.setupPlayer(200, 300, 'Player 1', 'right', this.player1_selection);
        this.player2 = this.setupPlayer(1000, 200, 'Player 2', 'left', this.player2_selection);

        this.physics.add.collider(this.player1, this.platforms);
        this.physics.add.collider(this.player2, this.platforms);

        this.seeds = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 10 });
        this.physics.add.collider(this.seeds, this.platforms, (seed) => seed.destroy());
        this.physics.add.collider(this.seeds, this.player1, this.handleSeedHit, null, this);
        this.physics.add.collider(this.seeds, this.player2, this.handleSeedHit, null, this);

        this.boosts = this.physics.add.staticGroup();
        this.boosts.create(600, 520, 'boost');
        this.boosts.create(150, 370, 'boost');
        this.physics.add.overlap(this.player1, this.boosts, this.collectBoost, null, this);
        this.physics.add.overlap(this.player2, this.boosts, this.collectBoost, null, this);

        this.turnText = this.add.text(16, 16, '', { fontSize: '24px', fill: '#fff' });
        this.player1HealthText = this.add.text(16, 50, '', { fontSize: '18px', fill: '#fff' });
        this.player2HealthText = this.add.text(config.width - 200, 50, '', { fontSize: '18px', fill: '#fff' });
        this.updateStatusText();

        this.keys = this.input.keyboard.addKeys('A,D,SPACE');
        this.aimingLine = this.add.graphics({ lineStyle: { width: 2, color: 0xff0000 } });
        this.input.on('pointerdown', this.fireSeed, this);

        this.gameState = {};
        this.startTurn(this.player1, this.player2);
    }

    update() {
        if (this.gameState.turnPhase === 'game_over') return;
        this.aimingLine.clear();
        if (this.gameState.turnPhase === 'move') {
            this.handlePlayerMovement();
            if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
                this.endMovePhase();
            }
        } else if (this.gameState.turnPhase === 'action') {
            this.drawAimingLine(this.input.activePointer);
        }
    }

    // --- All helper functions are now methods of GameScene ---

    drawAimingLine(pointer) {
        const startPoint = new Phaser.Math.Vector2(this.gameState.currentPlayer.x, this.gameState.currentPlayer.y);
        const endPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
        this.aimingLine.clear();
        this.aimingLine.lineBetween(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    }

    fireSeed(pointer) {
        if (this.gameState.turnPhase !== 'action') return;
        const seed = this.seeds.get(this.gameState.currentPlayer.x, this.gameState.currentPlayer.y, 'seed');
        if (seed) {
            seed.setActive(true).setVisible(true);
            this.physics.moveTo(seed, pointer.worldX, pointer.worldY, 500);
            seed.body.setCollideWorldBounds(true);
            seed.body.onWorldBounds = true;
            this.physics.world.on('worldbounds', (body) => {
                if (body.gameObject === seed) { seed.destroy(); }
            });
        }
        this.time.delayedCall(500, () => this.switchTurn());
    }

    handleSeedHit(player, seed) {
        if (player === this.gameState.otherPlayer) {
            const attacker = this.gameState.currentPlayer;
            const hitFromLeft = seed.body.velocity.x > 0;
            let damage = 20;
            if (attacker.hasBoost) {
                damage *= 2;
                attacker.hasBoost = false;
            }
            if ((player.facing === 'left' && hitFromLeft) || (player.facing === 'right' && !hitFromLeft)) {
                damage *= 1.5;
            }
            player.health -= damage;
            this.updateStatusText();
            if (player.health <= 0) {
                this.endGame(this.gameState.currentPlayer, player);
            }
        }
        seed.destroy();
    }

    collectBoost(player, boost) {
        if (player.hasBoost || player !== this.gameState.currentPlayer) return;
        boost.disableBody(true, true);
        player.hasBoost = true;
        this.updateStatusText();
    }

    setupPlayer(x, y, name, facing, spriteKey) {
        const player = this.physics.add.sprite(x, y, spriteKey);
        player.setBounce(0.1);
        player.setCollideWorldBounds(true);
        player.playerName = name;
        player.facing = facing;
        player.health = 100;
        player.hasBoost = false;
        const frontIndicator = this.add.sprite(facing === 'right' ? 8 : -8, 0, 'player_front');
        player.add(frontIndicator);
        return player;
    }

    startTurn(currentPlayer, otherPlayer) {
        this.gameState.currentPlayer = currentPlayer;
        this.gameState.otherPlayer = otherPlayer;
        this.gameState.turnPhase = 'move';
        this.turnText.setText(`${currentPlayer.playerName}'s Turn - Move Phase`);
        this.moveTimer = this.time.delayedCall(3000, () => this.endMovePhase());
    }

    endMovePhase() {
        if (this.gameState.turnPhase !== 'move') return;
        this.moveTimer.remove();
        this.gameState.turnPhase = 'action';
        this.turnText.setText(`${this.gameState.currentPlayer.playerName}'s Turn - Action Phase`);
        this.gameState.currentPlayer.setVelocityX(0);
    }

    switchTurn() {
        if (this.gameState.turnPhase === 'game_over') return;
        const lastPlayer = this.gameState.currentPlayer;
        this.startTurn(this.gameState.otherPlayer, lastPlayer);
    }

    handlePlayerMovement() {
        this.gameState.currentPlayer.setVelocityX(0);
        if (this.keys.A.isDown) {
            this.gameState.currentPlayer.setVelocityX(-160);
        } else if (this.keys.D.isDown) {
            this.gameState.currentPlayer.setVelocityX(160);
        }
    }

    updateStatusText() {
        let p1Text = `P1 Health: ${this.player1.health > 0 ? this.player1.health : 0}`;
        if (this.player1.hasBoost) { p1Text += '\nBoost Ready!'; }
        this.player1HealthText.setText(p1Text);

        let p2Text = `P2 Health: ${this.player2.health > 0 ? this.player2.health : 0}`;
        if (this.player2.hasBoost) { p2Text += '\nBoost Ready!'; }
        this.player2HealthText.setText(p2Text);
    }

    endGame(winner, loser) {
        this.gameState.turnPhase = 'game_over';
        this.turnText.setText(`${winner.playerName} wins!`);
        this.aimingLine.clear();
        loser.setAlpha(0.5);
    }
}


const config = {
    type: Phaser.CANVAS,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: [PreloadScene, SelectScene, GameScene]
};

const game = new Phaser.Game(config);