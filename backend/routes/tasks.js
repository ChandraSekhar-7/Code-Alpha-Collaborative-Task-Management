const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Task = require('../models/Task');

router.post('/:projectId', auth, async (req, res) => {
  try {
    const newTask = new Task({
      project: req.params.projectId,
      title: req.body.title,
      description: req.body.description,
      assignedTo: req.body.assignedTo || 'Unassigned'
    });
    const task = await newTask.save();
    
    // Emit WebSocket update
    req.io.to(req.params.projectId).emit('taskUpdated');
    res.status(201).json(task);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.get('/:projectId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId });
    res.json(tasks);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // Emit WebSocket update to project room
    req.io.to(task.project.toString()).emit('taskUpdated');
    res.json(task);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.post('/:id/comment', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    task.comments.push({ user: req.user.name, text: req.body.text });
    await task.save();
    
    req.io.to(task.project.toString()).emit('taskUpdated');
    res.json(task);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;