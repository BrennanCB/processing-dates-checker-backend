const mongoose = require('mongoose');
const {Schema} = mongoose;

const processingDatesSchema = new Schema({
  updatedAt: Date,
  processed: Date
});

mongoose.model('processingDates', processingDatesSchema);