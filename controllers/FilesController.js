import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue');

const FilesController = {
  async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisUserId = await redisClient.get(`auth_${token}`);
    if (!redisUserId) return res.status(401).send({ error: 'Unauthorized' });

    const { name } = req.body;
    if (!name) return res.status(400).send({ error: 'Missing name' });

    const { type } = req.body;
    const fileTypes = new Set(['file', 'folder', 'image']);
    if (!type || !fileTypes.has(type)) return res.status(400).send({ error: 'Missing type' });

    const { data } = req.body;
    if (!data && type !== 'folder') return res.status(400).send({ error: 'Missing data' });

    const parentId = req.body.parentId || 0;
    if (parentId) {
      const file = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(parentId) });
      if (!file) return res.status(400).send({ error: 'Parent not found' });
      if (file.type !== 'folder') return res.status(400).send({ error: 'Parent is not a folder' });
    }

    const isPublic = req.body.isPublic || false;
    const fileToStore = {
      userId: ObjectId(redisUserId),
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      const file = await dbClient.db.collection('files').insertOne(fileToStore);
      return res.status(201).send({
        id: file.insertedId,
        userId: fileToStore.userId,
        name: fileToStore.name,
        type: fileToStore.type,
        isPublic: fileToStore.isPublic,
        parentId: fileToStore.parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const filePath = `${folderPath}/${uuidv4()}`;

    if (!fs.existsSync(folderPath)) {
      await fs.mkdirSync(folderPath, { recursive: true }, (error) => {
        if (!error) return true;
        return false;
      });
    }

    const fileData = Buffer.from(data, 'base64');

    await fs.writeFile(filePath, fileData, (error) => {
      if (!error) return true;
      return false;
    });

    fileToStore.localPath = filePath;
    const file = await dbClient.db.collection('files').insertOne(fileToStore);

    fileQueue.add({ userId: fileToStore.userId, fileId: file.insertedId });

    return res.status(201).send({
      id: file.insertedId,
      userId: fileToStore.userId,
      name: fileToStore.name,
      type: fileToStore.type,
      isPublic: fileToStore.isPublic,
      parentId: fileToStore.parentId,
    });
  },

  async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).send({ error: 'Not found' });

    return res.send({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  },

  async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    let { parentId = '0' } = req.query;
    const { page } = req.query || 0;

    if (parentId !== '0') parentId = ObjectId(parentId);
    const fileCount = await dbClient.db
      .collection('files')
      .countDocuments({
        userId: ObjectId(userId),
        parentId,
      });
    if (!fileCount) return res.status(200).send([]);

    const maxPerPage = parseInt(page, 10) * 20;

    const filesList = await dbClient.db.collection('files')
      .find({
        userId: ObjectId(userId),
        parentId,
      })
      .skip(maxPerPage)
      .limit(20)
      .toArray();

    return res.status(200).send(filesList.map((file) => {
      const { _id, ...rest } = file;
      return { id: _id, ...rest };
    }));
  },

  async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!fileId) return res.status(404).send({ error: 'Not found' });

    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).send({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    return res.status(200).send({
      id: updatedFile._id,
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId,
    });
  },

  async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!fileId) return res.status(404).send({ error: 'Not found' });

    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).send({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    return res.status(200).send({
      id: updatedFile._id,
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId,
    });
  },

  async getFile(req, res) {
    const documentId = req.params.id;
    const size = req.query.size || 0;

    const document = await dbClient.db.collection('files').findOne({ _id: ObjectId(documentId) });
    if (!document) return res.status(404).send({ error: 'Not found' });

    const token = req.headers['x-token'];

    let userId = null;
    if (token) userId = await redisClient.get(`auth_${token}`);

    let user = null;
    if (userId) user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });

    if (!document.isPublic && !(
      user && user._id.toString() === document.userId.toString()
    )) return res.status(404).send({ error: 'Not found' });

    if (document.type === 'folder') return res.status(400).send({ error: "A folder doesn't have content" });

    const path = size === 0 ? document.localPath : `${document.localPath}_${size}`;

    try {
      const mimeType = mime.lookup(document.name);
      const content = fs.readFileSync(path);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(content);
    } catch (error) {
      return res.status(404).send({ error: 'Not found' });
    }
  },
};

export default FilesController;
