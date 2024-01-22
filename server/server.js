import express from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';

dotenv.config();

const openai = new OpenAI({
  key: process.env.OPENAI_API_KEY,
});

const app = express();

app.use(cors());
app.use(express.json());

// Conversación para OpenAI
const conversation = [
  { role: 'system', content: 'You are Marv, a chatbot that reluctantly answers questions with sarcastic responses.' },
  // Puedes agregar mensajes iniciales si lo deseas
];

let requestCount = 0;
let lastRequestTime = Date.now();

app.get('/', async (req, res) => {
  res.send('¡Hola! Esta es la ruta raísz.');
});

// Ruta para manejar las solicitudes de tu aplicación Angular
app.post('/api/interact', async (req, res) => {
  try {
    const userInput = req.body.promt; // Mensaje enviado por el usuario desde Angular

    // Verifica la tasa de solicitudes permitida (3 solicitudes cada 1.5 minutos)
    const currentTime = Date.now();
    const elapsedTimeSinceLastRequest = currentTime - lastRequestTime;

    if (requestCount >= 3 && elapsedTimeSinceLastRequest < 90000) {
      // Si se excede la tasa permitida, devuelve un error 429 (demasiadas solicitudes)
      res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
      return;
    }

    // Agrega el mensaje del usuario a la conversación
    conversation.push({ role: 'user', content: userInput });

    // Genera la respuesta utilizando OpenAI
    const openaiResponse = await generateOpenAIResponse(userInput);

    // Agrega la respuesta de OpenAI a la conversación
    conversation.push({ role: 'assistant', content: openaiResponse });

    // Incrementa el conteo de solicitudes y actualiza el tiempo de la última solicitud
    requestCount += 1;
    lastRequestTime = currentTime;

    // Devuelve la respuesta de OpenAI a la aplicación Angular
    res.status(200).json({ botResponse: openaiResponse });
  } catch (error) {
    console.error(error, 'error 500');
    res.status(500).json({ error: error.message });
  }
});

// Función para generar una respuesta utilizando OpenAI con reintento
async function generateOpenAIResponse(userInput, retryCount = 2) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: conversation,
      temperature: 0.5,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error(error);

    if (retryCount > 0 && error.response && error.response.status === 429) {
      // Retroceso exponencial: espera 10 segundos y vuelve a intentar
      await wait(10000);
      return generateOpenAIResponse(userInput, retryCount - 1);
    } else {
      throw error;
    }
  }
}

// Inicia el servidor en el puerto especificado
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Función para esperar un tiempo determinado (en milisegundos)
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
