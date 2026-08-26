// Puerto de src/public/components/Loader.tsx (v2): overlay de carga local (sin Redux),
// controlado por el estado propio de cada pagina — distinto del <Loader /> global de
// components/Loader.tsx, que lee el loaderStatus de Redux.
const LocalLoader = () => {
  return (
    <div className="backdrop">
        <div className="sk-chase sk-chase--big">
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
            <div className="sk-chase-dot"></div>
        </div>
    </div>
  );
};

export default LocalLoader;
