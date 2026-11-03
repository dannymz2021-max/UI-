// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const creatorBriefs=sqliteTable('creator_briefs',{id:text('id').primaryKey(),owner:text('owner').notNull(),briefJson:text('brief_json').notNull(),inputHash:text('input_hash').notNull(),createdAt:integer('created_at').notNull()},t=>[index('brief_owner_created').on(t.owner,t.createdAt)]);
export const creatorJobs=sqliteTable('creator_jobs',{id:text('id').primaryKey(),owner:text('owner').notNull(),status:text('status').notNull(),briefJson:text('brief_json').notNull(),model:text('model').notNull(),resultKey:text('result_key'),validationJson:text('validation_json'),providerRequestId:text('provider_request_id'),usageJson:text('usage_json'),errorCode:text('error_code'),errorMessage:text('error_message'),createdAt:integer('created_at').notNull()},t=>[index('job_owner_created').on(t.owner,t.createdAt)]);
export const creatorHealth=sqliteTable('creator_health',{owner:text('owner').primaryKey(),code:text('code'),checkedAt:integer('checked_at').notNull()});
