import { z } from 'zod';

/**
 * User validation schemas
 */
export const userSchemas = {
  register: z.object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be less than 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),

  login: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),

  updateProfile: z.object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be less than 50 characters')
      .optional(),
    email: z.string().email('Invalid email address').optional(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
};

/**
 * Server validation schemas
 */
export const serverSchemas = {
  create: z.object({
    name: z
      .string()
      .min(1, 'Server name is required')
      .max(100, 'Server name must be less than 100 characters'),
    description: z.string().max(500).optional(),
    gpuCount: z.number().int().min(0).max(100).default(0),
    location: z.string().max(200).optional(),
  }),

  update: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    gpuCount: z.number().int().min(0).max(100).optional(),
    location: z.string().max(200).optional(),
    status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR']).optional(),
  }),

  params: z.object({
    id: z.string().min(1, 'Server ID is required'),
  }),
};

/**
 * GPU validation schemas
 */
export const gpuSchemas = {
  allocate: z.object({
    gpuId: z.string().min(1, 'GPU ID is required'),
    taskId: z.string().min(1, 'Task ID is required'),
    userId: z.string().min(1, 'User ID is required'),
  }),

  release: z.object({
    allocationId: z.string().min(1, 'Allocation ID is required'),
  }),

  filter: z.object({
    model: z.string().optional(),
    minMemory: z.number().int().min(0).optional(),
    maxMemory: z.number().int().min(0).optional(),
  }),
};

/**
 * Task validation schemas
 */
export const taskSchemas = {
  create: z.object({
    name: z
      .string()
      .min(1, 'Task name is required')
      .max(200, 'Task name must be less than 200 characters'),
    description: z.string().max(1000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    gpuRequirements: z
      .object({
        model: z.string().optional(),
        minMemory: z.number().int().min(0).optional(),
        count: z.number().int().min(1).max(100).default(1),
      })
      .optional(),
  }),

  update: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  }),

  params: z.object({
    id: z.string().min(1, 'Task ID is required'),
  }),
};

/**
 * Monitoring validation schemas
 */
export const monitoringSchemas = {
  recordMetrics: z.object({
    serverId: z.string().min(1, 'Server ID is required'),
    cpuUsage: z.number().min(0).max(100),
    memoryUsage: z.number().min(0).max(100),
    gpuUsage: z.number().min(0).max(100).optional(),
    temperature: z.number().min(-50).max(150).optional(),
  }),

  queryMetrics: z.object({
    serverId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(1000).default(100),
  }),
};

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Validate request data
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    throw new Error(
      JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors,
      })
    );
  }

  return result.data;
}
