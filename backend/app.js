const express = require('express');
const xlsx = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const app = express();
const port = 3000;

app.use(cors());

const dataDirectory = path.join(__dirname, 'data');
const uploadDirectory = path.join(__dirname, 'test');

fs.ensureDirSync(uploadDirectory);

// 根路径路由
app.get('/', (req, res) => {
  res.send('<h1>Welcome to the Data API</h1><p>Use the API routes to access data.</p>');
});

// 递归读取文件夹中的所有文件
function readFiles(dir) {
  const files = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...readFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  });
  return files;
}

// 处理Excel文件
function processExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

// 处理CSV文件
function processCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// 动态生成API路由
async function setupRoutes(files) {
  for (const file of files) {
    const relativePath = path.relative(dataDirectory, file);
    const encodedPath = encodeURIComponent(relativePath).replace(/[!'()*]/g, escape);
    const routePath = `/api/data/${encodedPath}`;

    if (file.endsWith('.xlsx')) {
      app.get(routePath, (req, res) => {
        try {
          const data = processExcelFile(file);
          res.json(data);
        } catch (error) {
          console.error(`Error processing Excel file: ${file}`, error);
          res.status(500).send('Error processing Excel file');
        }
      });
    } else if (file.endsWith('.csv')) {
      app.get(routePath, async (req, res) => {
        try {
          const data = await processCSVFile(file);
          res.json(data);
        } catch (error) {
          console.error(`Error processing CSV file: ${file}`, error);
          res.status(500).send('Error processing CSV file');
        }
      });
    } else {
      console.log(`Skipping unsupported file type: ${file}`);
    }

    console.log(`API route created: ${routePath}`);
  }
}

// 设置文件存储路径
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// 处理文件上传
app.post('/api/upload', upload.single('file'), (req, res) => {
  res.json({ message: 'File uploaded successfully', file: req.file });
});

//导出数据为rar文件
const { exec } = require('child_process');

app.get('/api/export', async (req, res) => {
    try {
        const files = readFiles(dataDirectory);

        // 构建要压缩的文件列表
        let filesList = '';
        files.forEach(file => {
            filesList += `'${file}' `;
        });

        // 使用命令行工具rar创建RAR文件
        exec(`rar a exported_data.rar ${filesList}`, (error) => {
            if (error) {
                console.error('Error exporting data:', error);
                res.status(500).send('Error exporting data');
            } else {
                // 将创建的RAR文件发送给客户端
                res.download('exported_data.rar');
            }
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).send('Error exporting data');
    }
});

// 读取所有文件并设置路由
const files = readFiles(dataDirectory);
setupRoutes(files).then(() => {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
});
