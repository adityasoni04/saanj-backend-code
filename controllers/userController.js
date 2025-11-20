import User from '../models/userModel.js'; // Make sure this path is correct


export const getAllUsers = async (req, res) => {
  try {
    // Find all users, remove the password, and sort by creation date
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
      
    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Error fetching all users', error: error.message });
  }
};