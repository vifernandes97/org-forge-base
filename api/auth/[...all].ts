import { toNodeHandler } from 'better-auth/node';
import { auth } from '../../server/auth.js';

// /api/auth/* — login, sessão, /token (JWT da Data API) e /jwks (que o Neon lê).
export const config = { api: { bodyParser: false } };

export default toNodeHandler(auth);
