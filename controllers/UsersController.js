import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue');

const UsersController = {
  async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) return res.status(400).send({ error: 'Missing email' });
    if (!password) return res.status(400).send({ error: 'Missing password' });

    const usersCollection = await dbClient.db.collection('users');

    const retreivedUser = await usersCollection.findOne({ email });
    if (retreivedUser) return res.status(400).send({ error: 'Already exist' });

    const hashedPassword = sha1(password);
    const insertedUser = await usersCollection.insertOne({
      email,
      password: hashedPassword,
    });

    userQueue.add({ userId: insertedUser.insertedId });

    return res.status(201).send({ id: insertedUser.insertedId, email });
  },

  async getMe(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisUserId = await redisClient.get(`auth_${token}`);
    if (!redisUserId) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisUserId) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    return res.status(200).send({ id: user._id, email: user.email });
  },
};

export default UsersController;
