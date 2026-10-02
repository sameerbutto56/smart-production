import toast from 'react-hot-toast';

/**
 * Extracts a clear, user-friendly error message from backend responses.
 */
export function getErrorMessage(error, fallback = 'Action could not be completed. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.response?.data?.error) return error.response.data.error;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.details) return error.response.data.details;
  if (error.message) return error.message;
  return fallback;
}

/**
 * Executes an async action with automatic loading, success feedback, and clear error extraction.
 */
export async function runActionWithFeedback({
  actionFn,
  successMessage,
  fallbackErrorMessage,
  onSuccess,
  onError,
}) {
  try {
    const result = await actionFn();
    if (successMessage) {
      toast.success(successMessage);
    }
    if (onSuccess) onSuccess(result);
    return { success: true, result };
  } catch (err) {
    const msg = getErrorMessage(err, fallbackErrorMessage);
    toast.error(msg);
    if (onError) onError(err, msg);
    return { success: false, error: err, message: msg };
  }
}
