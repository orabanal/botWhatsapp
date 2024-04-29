const { createBot, createProvider, createFlow, addKeyword, EVENTS, gotoFlow, fallBack, flowDynamic } = require('@bot-whatsapp/bot');
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
//const MockAdapter = require('@bot-whatsapp/database/mock');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");
const { handlerAI } = require("./whisper");

const menuPath = path.join(__dirname, "mensajes", "menu.txt");
const menu = fs.readFileSync(menuPath, "utf8");

const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const flowVoice = addKeyword(EVENTS.VOICE_NOTE).addAnswer("Un momento, estoy procesando tu nota de voz...", null, async (ctx, ctxFn) => {
    const text = await handlerAI(ctx);
    const prompt = promptConsultas;
    const consulta = text;
    const answer = await chat(prompt, consulta);
    await ctxFn.flowDynamic(answer.content);
});

const flowMenuRest = addKeyword(EVENTS.ACTION)
    .addAnswer('Este es el menu', {
        media: "https://www.ujamaaresort.org/wp-content/uploads/2018/01/Ujamaa-restaurant-menu.pdf"
    });

const flowReservar = addKeyword(EVENTS.ACTION)
    .addAnswer('Para hacer tu reserva puedes entrar a la siguiente ruta: www.haztureserva.com');

const flowConsultas = addKeyword(EVENTS.ACTION)
   // .addAnswer('Este es el flow consultas')
    .addAnswer("Escribe tu consulta", { capture: true }, async (ctx, ctxFn) => {
        const prompt = promptConsultas;
        const consulta = ctx.body;
        const answer = await chat(prompt, consulta);
        await ctxFn.flowDynamic(answer.content);
    });

let welcomed = false;
const welcomeTimeout = 10 * 60 * 1000; // 10 minutos

const flowWelcome = addKeyword(EVENTS.WELCOME)
    .addAnswer ('...',{ 
            delay: 100,
            } ,
            async (ctx, ctxFn) => {
            if (ctx.body.toLowerCase().includes("hola") || !welcomed) {
                await ctxFn.flowDynamic([
                    {
                        body:" ",
                        media:'https://i.imgur.com/0HpzsEm.png'
                    }]);
                await ctxFn.flowDynamic("😙😙😙 hola como estas, en que puedo ayudarte hoy");
                welcomed = true;
            } else {
                const prompt = promptConsultas;
                const consulta = ctx.body;
                const answer = await chat(prompt, consulta);
                await ctxFn.flowDynamic(answer.content);
                await ctxFn.flowDynamic("Tambien puedes escribir la palabra *MENU* para ver las opciones disponibles");
            }
        // Reiniciar la variable de bienvenida después de 10 minutos
        setTimeout(() => {
            welcomed = false; 
        }, welcomeTimeout);
    });

const menuFlow = addKeyword("Menu").addAnswer(
    menu,
    { capture: true },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
        if (!["1", "2", "3", "0"].includes(ctx.body)) {
            return fallBack(
                "Respuesta no válida, por favor selecciona una de las opciones."
            );
        }
        switch (ctx.body) {
            case "1":
                return gotoFlow(flowMenuRest);
            case "2":
                return gotoFlow(flowReservar);
            case "3":
                return gotoFlow(flowConsultas);
            case "0":
                return await flowDynamic(
                    "Saliendo... Puedes volver a acceder a este menú escribiendo '*MENU*'"
                );
        }
    }
);

const main = async () => {
    require("dotenv").config();
    const adapterDB = new MongoAdapter({
        dbUri: process.env.MONGO_DB_URI,
        dbName: "dbVector"
    });
    const adapterFlow = createFlow([flowWelcome, menuFlow, flowMenuRest, flowReservar, flowConsultas, flowVoice]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb();
};

main();
