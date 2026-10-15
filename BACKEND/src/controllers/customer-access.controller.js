
import * as customerAccessService from '../services/customer-access.service.js';
import { jobIdSchema } from '../validators/job.validator.js';
import { issueCustomerAccessToken } from '../services/customer-access.service.js';

export const handleGetCustomerJob = async (req, res) => {
  try {
    const job = await customerAccessService.getCustomerJob(
      req.customerAccess.jobId,
    );

    if (!job) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer job not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: { job },
    });
  } catch {
    return res.status(500).json({
      status: 'error',
      message: 'Unable to retrieve customer job',
    });
  }
};


export const handleIssueCustomerAccessToken = async (req, res) => {
  const parsed = jobIdSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid job ID',
    });
  }

  try {
    const result = await issueCustomerAccessToken(
      req.user.businessId,
      parsed.data.id,
    );

    return res.status(201).json({
      status: 'success',
      data: {
        token: result.token,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: error.statusCode ? 'fail' : 'error',
      message: error.statusCode
        ? error.message
        : 'Unable to issue customer access link',
    });
  }
};


