import { MongoClient } from 'mongodb';

/**
 * A mongoDB connection class.
 */
class DBClient {
  constructor() {
    /**
     * The class constructor...
     */
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';
    this.mongoURI = `mongodb://${this.host}:${this.port}`;

    this.client = new MongoClient(this.mongoURI, { useUnifiedTopology: true });
    this.client.connect();
    this.db = this.client.db(this.database);
  }

  isAlive() {
    /**
     * A method that checks the life of a connection.
     * @return true if the connection is alive, false otherwise.
     */
    return this.client.topology.isConnected();
  }

  async nbUsers() {
    /**
     * A method that returns the number of documents in the collection 'users'.
     */
    const usersCollection = this.db.collection('users');
    const documentsCount = await usersCollection.countDocuments();
    return documentsCount;
  }

  async nbFiles() {
    /**
     * A method that returns the number of documents in the collection 'files'.
     */
    const filesCollection = this.db.collection('files');
    const documentsCount = await filesCollection.countDocuments();
    return documentsCount;
  }
}

/**
 * Exporting an instance...
 */
const redisClient = new DBClient();
export default redisClient;
