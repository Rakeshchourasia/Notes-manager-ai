const mongoose = require('mongoose');
const Syllabus = require('./models/Syllabus');
const Topic = require('./models/Topic');

mongoose.connect('mongodb://localhost:27017/noteai')
  .then(async () => {
    console.log('Connected to DB');
    const recentSyllabus = await Syllabus.findOne().sort({ createdAt: -1 }).populate('topics');
    if (!recentSyllabus) {
      console.log('No syllabus found');
    } else {
      console.log('Recent Syllabus:', recentSyllabus.title, recentSyllabus._id);
      console.log('Topics count:', recentSyllabus.topics.length);
      console.log('Topics:', JSON.stringify(recentSyllabus.topics, null, 2));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
