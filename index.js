import dotenv from "dotenv";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

dotenv.config();

// 🔗 Base URL
const PHONE_NUMBER_ID = "1085759097962689";
const BASE_URL = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}`;

// 📩 1. Send Template Message
async function sendTemplateMessage() {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages`,
      {
        messaging_product: "whatsapp",
        to: "919893601774",
        type: "template",
        template: {
          name: "welcome_template", // make sure this exists
          language: {
            code: "en_US",
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      },
    );

    console.log("✅ Template Sent:", response.data);
  } catch (error) {
    console.error("❌ Template Error:", error.response?.data || error.message);
  }
}

// 💬 2. Send Text Message
async function sendTextMessage() {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages`,
      {
        messaging_product: "whatsapp",
        to: "919893601774",
        type: "text",
        text: {
          body: "This is a text message 🚀",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      },
    );

    console.log("✅ Text Sent:", response.data);
  } catch (error) {
    console.error("❌ Text Error:", error.response?.data || error.message);
  }
}

// 🖼️ 3. Send Image via URL (BEST METHOD)
async function sendMediaMessage() {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages`,
      {
        messaging_product: "whatsapp",
        to: "919893601774",
        type: "image",
        image: {
          link: "https://dummyimage.com/600x400/000/fff.png&text=TradeSetu+Network",
          caption: "This is a media message 📸",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      },
    );

    console.log("✅ Image Sent:", response.data);
  } catch (error) {
    console.error("❌ Media Error:", error.response?.data || error.message);
  }
}

// 📤 4. Upload Image (ONLY if needed)
async function uploadImage() {
  const form = new FormData();

  form.append("messaging_product", "whatsapp");
  form.append("file", fs.createReadStream("./logo.png"));
  form.append("type", "image/png");

  try {
    const response = await axios.post(`${BASE_URL}/media`, form, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        ...form.getHeaders(),
      },
    });

    console.log("✅ Uploaded Media ID:", response.data);
    return response.data.id; // use this ID to send media later
  } catch (error) {
    console.error("❌ Upload Error:", error.response?.data || error.message);
  }
}

async function sendMediaMessageUsingUploadedMedia() {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages`,
      {
        messaging_product: "whatsapp",
        to: "919893601774",
        type: "image",
        image: {
          id: "1437642544799816",
          //   link: "https://dummyimage.com/600x400/000/fff.png&text=TradeSetu+Network",

          caption: "This is a media message 📸",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      },
    );

    console.log("✅ Image Sent:", response.data);
  } catch (error) {
    console.error("❌ Media Error:", error.response?.data || error.message);
  }
}

async function sendTemplateMessageWithVariables() {
  try {
    const response = await axios.post(
      `${BASE_URL}/messages`,
      {
        messaging_product: "whatsapp",
        to: "919893601774",
        type: "template",
        template: {
          name: "welcome_template", // make sure this exists
          language: {
            code: "en_US",
          },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "text",
                  text: "Aditya",
                },
              ],
            },
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: "50",
                },
              ],
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      },
    );

    console.log("✅ Template Sent:", response.data);
  } catch (error) {
    console.error("❌ Template Error:", error.response?.data || error.message);
  }
}

// 🧪 Debug
console.log("ENV TOKEN:", process.env.WHATSAPP_TOKEN?.slice(0, 10));

// 🔥 CALL ANY ONE FUNCTION
// sendTextMessage();
// sendTemplateMessage();
// sendMediaMessage();
// uploadImage();
// sendMediaMessageUsingUploadedMedia();
