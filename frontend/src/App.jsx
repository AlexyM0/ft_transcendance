import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/hello')
      .then(res => res.json())
      .then(data => setMsg(data.message));
  }, []);

  return <h1>{msg || "Loading..."}</h1>;
}

export default App;
