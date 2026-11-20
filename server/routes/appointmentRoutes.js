/**
 * LifeLink — Appointment Routes (Phase 10)
 *
 * All routes require JWT authentication (`protect`).
 *
 * Endpoints:
 *   POST  /api/appointments          — Book a new appointment
 *   GET   /api/appointments          — List user's appointments
 *   GET   /api/appointments/:id      — Get appointment details
 *   PATCH /api/appointments/:id/cancel — Cancel an appointment
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment
} = require('../controllers/appointmentController');

router.post('/', protect, createAppointment);
router.get('/', protect, getMyAppointments);
router.get('/:id', protect, getAppointmentById);
router.patch('/:id/cancel', protect, cancelAppointment);

module.exports = router;
