import React from 'react'
import ReactDOM from 'react-dom/client'
import { PlanProvider } from './estado/PlanProvider.jsx'
import App from './App.jsx'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><PlanProvider><App /></PlanProvider></React.StrictMode>
)
