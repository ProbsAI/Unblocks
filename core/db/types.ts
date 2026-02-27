import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { users } from './schema/users'
import type { sessions } from './schema/sessions'
import type { subscriptions } from './schema/subscriptions'
import type { accounts } from './schema/accounts'
import type { verificationTokens } from './schema/verificationTokens'

export type DbUser = InferSelectModel<typeof users>
export type NewDbUser = InferInsertModel<typeof users>

export type DbSession = InferSelectModel<typeof sessions>
export type NewDbSession = InferInsertModel<typeof sessions>

export type DbSubscription = InferSelectModel<typeof subscriptions>
export type NewDbSubscription = InferInsertModel<typeof subscriptions>

export type DbAccount = InferSelectModel<typeof accounts>
export type NewDbAccount = InferInsertModel<typeof accounts>

export type DbVerificationToken = InferSelectModel<typeof verificationTokens>
export type NewDbVerificationToken = InferInsertModel<typeof verificationTokens>
