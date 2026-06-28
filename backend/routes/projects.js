const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Project = require('../models/Project');

router.post('/', auth, async (req, res) => {
  try {
    const newProject = new Project({
      name: req.body.name,
      description: req.body.description,
      owner: req.user.id
    });
    const project = await newProject.save();
    res.status(201).json(project);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;