require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    GatewayIntentBits,
} = require("discord.js");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    entersState,
    VoiceConnectionStatus,
} = require("@discordjs/voice");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
    },
});

let connection;
let queue = [];
let playing = false;

const AUDIO_FILE = path.join(__dirname, "welcome.mp3");

async function connectVoice() {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);

    const channel = await guild.channels.fetch(
        process.env.VOICE_CHANNEL_ID
    );

    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfMute: false,
        selfDeaf: false,
    });

    connection.subscribe(player);

    try {
        await entersState(
            connection,
            VoiceConnectionStatus.Ready,
            30000
        );

        console.log("✅ Connected to voice channel.");
    } catch (err) {
        console.log("❌ Voice connection failed.");
    }

    connection.on("stateChange", async (_, newState) => {
        if (
            newState.status === VoiceConnectionStatus.Disconnected
        ) {
            console.log("🔄 Reconnecting...");

            try {
                await entersState(
                    connection,
                    VoiceConnectionStatus.Connecting,
                    5000
                );
            } catch {
                connectVoice();
            }
        }
    });
}

function playNext() {
    if (playing) return;

    if (queue.length === 0) return;

    playing = true;

    const file = queue.shift();

    const resource = createAudioResource(file);

    player.play(resource);
}

player.on(AudioPlayerStatus.Idle, () => {
    playing = false;

    playNext();
});

player.on("error", (error) => {
    console.error(error);

    playing = false;

    playNext();
});

client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    if (!fs.existsSync(AUDIO_FILE)) {
        console.log("❌ welcome.mp3 not found.");
        process.exit(1);
    }

    await connectVoice();
});
client.on("voiceStateUpdate", (oldState, newState) => {
    // تجاهل البوتات
    if (newState.member?.user.bot) return;

    // العضو دخل القناة المحددة
    if (
        oldState.channelId !== process.env.VOICE_CHANNEL_ID &&
        newState.channelId === process.env.VOICE_CHANNEL_ID
    ) {
        console.log(`${newState.member.user.tag} joined the voice channel.`);

        // إضافة ملف الصوت إلى قائمة الانتظار
        queue.push(AUDIO_FILE);

        // تشغيل الصوت إذا لم يكن هناك صوت يعمل
        playNext();
    }
});

// تسجيل دخول البوت
client.login(process.env.TOKEN);