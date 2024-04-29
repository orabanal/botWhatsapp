const { createBot, createProvider, createFlow, addKeyword, EVENTS, gotoFlow, fallBack, flowDynamic } = require('@bot-whatsapp/bot');
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");
const { handlerAI } = require("./whisper");

const menuPath = path.join(__dirname, "mensajes", "menu.txt");
const saludoPath = path.join(__dirname, "mensajes", "saludo.txt");
const menu = fs.readFileSync(menuPath, "utf8");
const saludo= fs.readFileSync(saludoPath,"utf8");

const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const flowVoice = addKeyword(EVENTS.VOICE_NOTE).addAnswer("Un momento, estoy procesando tu nota de voz...", null, async (ctx, ctxFn) => {
    try {
        const text = await handlerAI(ctx);
        const prompt = promptConsultas;
        const consulta = text;
        const answer = await chat(prompt, consulta);
        await ctxFn.flowDynamic(answer.content);
    } catch (error) {
        console.error('Error en flowVoice:', error);
        await ctxFn.flowDynamic('Lo siento, ocurrió un error al procesar tu nota de voz. Por favor, inténtalo de nuevo.');
    }
});

const flowMenuRest = addKeyword(EVENTS.ACTION)
    .addAnswer('Este es el menu', {
        media: "https://www.ujamaaresort.org/wp-content/uploads/2018/01/Ujamaa-restaurant-menu.pdf"
    });

const flowReservar = addKeyword(EVENTS.ACTION)
    .addAnswer('Para hacer tu reserva puedes entrar a la siguiente ruta: www.haztureserva.com');

const flowConsultas = addKeyword(EVENTS.ACTION)
    .addAnswer("Escribe tu consulta", { capture: true }, async (ctx, ctxFn) => {
        try {
            const prompt = promptConsultas;
            const consulta = ctx.body;
            const answer = await chat(prompt, consulta);
            await ctxFn.flowDynamic(answer.content);
        } catch (error) {
            console.error('Error en flowConsultas:', error);
            await ctxFn.flowDynamic('Lo siento, ocurrió un error al procesar tu consulta. Por favor, inténtalo de nuevo.');
        }
    });

let welcomed = false;
const welcomeTimeout = 10 * 60 * 1000; // 10 minutos

const flowWelcome = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, ctxFn) => {
        try {
            if (ctx.body.toLowerCase().includes("hola") || !welcomed) {
                await ctxFn.flowDynamic([
                    {
                        body: saludo,
                        delay:500
                    }
                ]);
                // await ctxFn.flowDynamic("😙😙😙 hola como estas, en que puedo ayudarte hoy");
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
        } catch (error) {
            console.error('Error en flowWelcome:', error);
            await ctxFn.flowDynamic('Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo.');
        }
    });

const flowDespedida = addKeyword('adios')
    .addAnswer('¡Hasta luego! Espero haberte sido de ayuda. ¡Vuelve pronto!',{
        delay: 500,
    })

const menuFlow = addKeyword("Menu").addAnswer(
    menu,
    { capture: true,
     delay: 500
    },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
        try {
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
        } catch (error) {
            console.error('Error en menuFlow:', error);
            await flowDynamic('Lo siento, ocurrió un error al procesar tu solicitud. Por favor, inténtalo de nuevo.');
        }
    }
);

const main = async () => {
    try {
        require("dotenv").config();
        const adapterDB = new MongoAdapter({
            dbUri: process.env.MONGO_DB_URI,
            dbName: "dbVector"
        });
        const adapterFlow = createFlow([flowWelcome, menuFlow, flowMenuRest, flowReservar, flowConsultas, flowVoice,flowDespedida]);
        const adapterProvider = createProvider(BaileysProvider);

        createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        });

        QRPortalWeb();
    } catch (error) {
        console.error('Error en main:', error);
    }
};

main();