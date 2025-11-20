import jwt from 'jsonwebtoken';

// Generate token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

export const googleCallback = (req, res) => {
  const token = generateToken(req.user._id, req.user.role);

  // 2. Create the user object
  const user = {
    _id: req.user._id,
    displayName: req.user.displayName,
    email: req.user.email,
    image: req.user.image,
    role: req.user.role,
  };

  // 3. Send an HTML script back to the popup
  // This script will send the data to your React app and then close itself
  const script = `
    <script>
      const data = {
        token: "${token}",
        user: ${JSON.stringify(user)}
      };
      
      // Send the data to the main window (your React app)
      // IMPORTANT: Change 'http://localhost:3000' if your React app runs on a different port (like 5173 for Vite)
      window.opener.postMessage(data, 'http://localhost:8080');
      
      // Close this popup window
      window.close();
    </script>
  `;

  res.send(script);
};


export const getProfile = async (req, res) => {
  res.status(200).json(req.user);
};

