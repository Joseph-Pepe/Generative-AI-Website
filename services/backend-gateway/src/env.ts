// Load .env.local from monorepo root or local directory BEFORE database imports
import dotenv from 'dotenv';
import path from 'path';

// 1. MUST BE FIRST: Load the local backend config (sets PORT=8000)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 2. MUST BE SECOND: Fallback to the root monorepo config for shared keys (like GOOGLE_GEMINI_API_KEY)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });

// 3. Standard fallback for .env
dotenv.config();