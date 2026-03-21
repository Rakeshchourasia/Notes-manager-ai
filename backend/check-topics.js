const mongoose = require('mongoose');
const Syllabus = require('./models/Syllabus');
const Topic = require('./models/Topic');

mongoose.connect('mongodb://localhost:27017/noteai')
  .then(async () => {
    const recentSyllabus = await Syllabus.findOne().sort({ createdAt: -1 }).populate('topics');
    if (recentSyllabus && recentSyllabus.topics) {
      recentSyllabus.topics.forEach(t => {
        console.log(`- ID: ${t._id}, Name: "${t.name}", Order: ${t.order}`);
      });
    }
    process.exit(0);
  });
