export function isTemporaryAuthError(error) {
  return Boolean(error && (
    error.name === 'AuthRetryableFetchError' ||
    error.name === 'TimeoutError' || error.name === 'AbortError' ||
    error.status === 0 || error.status === 429 || error.status >= 500 ||
    /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(error.message || '')
  ));
}

export function authErrorMessage(error) {
  if (isTemporaryAuthError(error)) {
    return 'We cannot reach the account service right now. Check your connection and try again shortly. If you already have an account, you can sign in when the service is back.';
  }
  if (error?.code === 'invalid_credentials') return 'The email or password is incorrect. Try again or reset your password.';
  if (error?.code === 'email_not_confirmed') return 'Please confirm your email before signing in. You can request a new confirmation link below.';
  return error?.message || 'We could not complete that request. Please try again.';
}

export async function authResult(request) {
  try {
    const result = await request();
    if (result.error) throw result.error;
    return result.data;
  } catch (error) {
    const friendly = new Error(authErrorMessage(error), { cause: error });
    friendly.code = error.code;
    friendly.status = error.status;
    throw friendly;
  }
}
