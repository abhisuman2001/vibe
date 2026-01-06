import { appConfig } from '#root/config/app.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {BadRequestError, NotFoundError} from 'routing-controllers';
// Abhishek Suman made changes: Added ObjectId import for MongoDB queries
import { ObjectId } from 'mongodb';

@injectable()
export class UserService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  // Abhishek Suman made changes: Aggregate daily study time for user (for activity heatmap)
  // Fixed collection name, user ID handling, and duration calculation
  async getUserStudyActivityByDay(userId: string, year?: number): Promise<{ date: string, count: number }[]> {
    try {
      // Abhishek Suman made changes: Handle both Firebase UID and MongoDB ObjectId
      // First, check if userId is a Firebase UID or MongoDB ObjectId
      let mongoUserId: string;
      
      // Try to find user by Firebase UID first (most likely case from frontend)
      const userByFirebaseUID = await this.userRepo.findByFirebaseUID(userId);
      if (userByFirebaseUID) {
        mongoUserId = userByFirebaseUID._id!.toString();
      } else {
        // If not found by Firebase UID, assume it's already a MongoDB ObjectId
        mongoUserId = userId;
      }

      // Abhishek Suman made changes: Fixed collection name from 'watchtimes' to 'watchTime'
      // Updated: Filter by year if provided
      const watchtimes = await this.database.getCollection('watchTime'); // Fixed collection name
      // Abhishek Suman made changes: Convert string ID to ObjectId for MongoDB query
      const match: any = { userId: new ObjectId(mongoUserId) };
      if (year) {
        match.startTime = {
          $gte: new Date(`${year}-01-01T00:00:00.000Z`),
          $lte: new Date(`${year}-12-31T23:59:59.999Z`)
        };
      }
      // Abhishek Suman made changes: Fixed aggregation pipeline to calculate duration from startTime/endTime
      // instead of non-existent 'seconds' field
      const pipeline = [
        { $match: match },
        // Only include records that have both startTime and endTime
        { $match: { 
          startTime: { $exists: true, $ne: null },
          endTime: { $exists: true, $ne: null }
        }},
        // Calculate duration in seconds from startTime and endTime
        { $addFields: {
          durationSeconds: {
            $divide: [
              { $subtract: ['$endTime', '$startTime'] },
              1000 // Convert milliseconds to seconds
            ]
          }
        }},
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          totalSeconds: { $sum: '$durationSeconds' }
        }},
        { $project: {
          _id: 0,
          date: '$_id',
          count: { $ceil: { $divide: ['$totalSeconds', 60] } } // convert to minutes
        }},
        { $sort: { date: 1 } }
      ];
      const result = await watchtimes.aggregate(pipeline).toArray();
      // Abhishek Suman made changes: Added type casting for proper return type
      return (result as { date: string, count: number }[]) || [];
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }
  }

  async getUserById(userId: string): Promise<IUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async editUser(userId: string, body: { firstName: string; lastName: string }): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    await this.userRepo.edit(userId, {
      firstName: body.firstName,
      lastName: body.lastName,
    });
  }

  async makeAdmin(userId: string, password: string): Promise<void> {
    if (password !== appConfig.adminPassword) {
      throw new BadRequestError('Invalid admin password');
    }
    
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    await this.userRepo.makeAdmin(userId, null as any);
  }
}

