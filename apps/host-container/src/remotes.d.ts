/*
    - TypeScript is a static compile-time analyzer.
    - Module Federation injects micro-frontends over the network at runtime.
    - Need to let TypeScript know Trust me, this module exists at runtime and exports a React component.
*/


// Declares the remote micro-frontend module so TypeScript recognizes the import
declare module 'mfeAudioGenerator/GeneratorStudio' {
  import React from 'react';
  
  // Define what the remote module exports (in our case, the default App component)
  const GeneratorStudio: React.ComponentType<any>;
  export default GeneratorStudio;
}

// To add more micro-frontends later, append more declare blocks to this same file....