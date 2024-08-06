import express from 'express';
import router from './routes/index';

const server = express();
const port = process.env.PORT || 5000;

server.use(express.json());
server.use(router);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
