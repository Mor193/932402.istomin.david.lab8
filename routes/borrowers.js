import { Router } from 'express';
import db from '../database/db.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const borrowers = db.prepare('SELECT id, full_name, contact FROM borrowers ORDER BY full_name ASC').all();
    res.json(borrowers);
  } catch (err) {
    next(err);
  }
});

export default router;