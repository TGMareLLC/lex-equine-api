import React from "react";

const AccessContext = React.createContext({
  isCaretakerOnly: false,
});

export function AccessProvider({
  isCaretakerOnly = false,
  children,
}) {
  return (
    <AccessContext.Provider value={{ isCaretakerOnly }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  return React.useContext(AccessContext);
}