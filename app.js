import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import xml2js from 'xml2js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import open from 'open';

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define functions
function parseMT940(data) {
  const transactions = [];
  const lines = data.split('\n');

  lines.forEach((line) => {
    if (line.startsWith(':61:')) {
      const transaction = parseTransaction(line);
      transactions.push(transaction);
    }
  });

  return { transactions };
}

function parseTransaction(line) {
  // Basic parsing logic, adjust according to your needs
  return {
    date: line.substr(4, 6), // Example extraction logic
    amount: parseFloat(line.substr(10, 15)),
    description: line.substr(25).trim(),
  };
}

function convertToExcel(data) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.transactions);
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function convertToXML(data, callback) {
  const builder = new xml2js.Builder();
  const xml = builder.buildObject(data);
  callback(xml);
}

async function convertToOFX(data) {
  const { OFX } = await import('ofx-js'); // Dynamically import OFX
  const ofx = new OFX(); // Create OFX instance

  // Construct OFX document
  const ofxData = {
    OFX: {
      BANKTRANLIST: {
        STMTTRN: data.transactions.map((t) => ({
          TRNTYPE: 'CHECKING', // Adjust as needed
          DTPOSTED: t.date, // Format date as needed
          TRNAMT: t.amount,
          NAME: t.description,
        })),
      },
    },
  };

  const ofxString = ofx.createOFX(ofxData); // Ensure correct method is used
  return Buffer.from(ofxString); // Return a Buffer
}

// Initialize Express app
const app = express();
const PORT = 3000;
const upload = multer({ dest: 'uploads/' });

// Serve static files from the "public" directory
app.use(express.static('public'));

// POST endpoint to handle file uploads
app.post('/upload', upload.single('mt940'), async (req, res) => {
  const filePath = req.file.path;
  const outputType = req.body.outputType;
  const originalFileName = path.basename(
    req.file.originalname,
    path.extname(req.file.originalname)
  );

  try {
    const data = fs.readFileSync(filePath, 'utf8'); // Synchronously read file content
    const parsedData = parseMT940(data);

    let outputFilePath;
    let content;

    if (outputType === 'excel') {
      const excelBuffer = convertToExcel(parsedData);
      outputFilePath = path.join(
        __dirname,
        'output',
        `${originalFileName}.xlsx`
      );
      content = excelBuffer;
    } else if (outputType === 'xml') {
      const xml = await new Promise((resolve) =>
        convertToXML(parsedData, resolve)
      );
      outputFilePath = path.join(
        __dirname,
        'output',
        `${originalFileName}.xml`
      );
      content = xml;
    } else if (outputType === 'ofx') {
      const ofxBuffer = await convertToOFX(parsedData); // Await the result
      outputFilePath = path.join(
        __dirname,
        'output',
        `${originalFileName}.ofx`
      );
      content = ofxBuffer;
    } else {
      return res.status(400).send('Invalid output type');
    }

    fs.writeFileSync(outputFilePath, content);
    res.download(outputFilePath, `${originalFileName}.${outputType}`, () => {
      fs.unlinkSync(outputFilePath);
    });
  } catch (error) {
    res.status(500).send('Error processing file');
    console.error(error);
  } finally {
    fs.unlinkSync(filePath); // Clean up the uploaded file
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  // Automatically open the browser
  open(`http://localhost:${PORT}`);
});
