import apiApplication from "../../../api/apiApplication";
import Sidebar from "./components/Sidebar";
import { useState } from "react";
import Swal from "sweetalert2";

function CambiarPassword() {
  const [actualPassword, setActualPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const handleActualizarPassword = async () => {
    if (!actualPassword || !newPassword || !newPasswordConfirm) {
      return Swal.fire("Error", "Todos los campos son obligatorios", "error");
    }

    if (newPassword !== newPasswordConfirm) {
      return Swal.fire("Error", "Las nuevas contraseñas no coinciden", "error");
    }

    const confirmacion = await Swal.fire({
        title: "¿Estás seguro?",
        text: "Se cambiará tu contraseña actual",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, cambiar",
        cancelButtonText: "Cancelar",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const params = {
        actualPassword,
        newPassword,
      };

      const { data } = await apiApplication.patch("/usuarios/update/perfil", params);
      console.log(data);

      Swal.fire("Éxito", "Contraseña actualizada correctamente", "success");
      setActualPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (error:any) {
        Swal.fire("Error", error.response.data.message || "Hubo un problema al actualizar la contraseña", "error");
      console.log(error);
    }
  };

  return (
    <div
      style={{
        backgroundImage: `url('/bg_perfil.svg')`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top",
        backgroundSize: "100%",
        paddingTop: "40px",
      }}
    >
      <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
        <div className="grid grid-cols-7 gap-4 items-start mb-5">
          <Sidebar />
          <section className="bg-gray-50 shadow-md rounded-xl col-span-7 md:col-span-4 lg:col-span-5 p-4">
            <h2 className="text-gray-800 text-2xl 2xl:text-3xl font-semibold">Cambiar contraseña</h2>
            <hr className="my-3" />
            <fieldset className="mt-5 border border-gray-300 rounded-lg p-2 md:p-4 grid md:grid-cols-2 gap-4 w-full">
              <legend className="text-gray-600 text-xl font-medium col-span-2">Establecer nueva contraseña</legend>
              <label className="font-medium text-gray-700 col-span-2 md:col-span-2 lg:col-span-1" htmlFor="actual_password">
                Contraseña actual:
                <input
                  type="password"
                  value={actualPassword}
                  onChange={(e) => setActualPassword(e.target.value)}
                  id="actual_password"
                  className="block border border-gray-300 rounded-md p-2 w-full"
                  placeholder="Ingrese su contraseña actual"
                />
              </label>
              <label htmlFor="" className="none md:block invisible col-span-2 md:col-span-2 lg:col-span-1"></label>
              <label className="font-medium text-gray-700 col-span-2 md:col-span-2 lg:col-span-1" htmlFor="password">
                Contraseña nueva:
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  id="password"
                  className="block border border-gray-300 rounded-md p-2 w-full"
                  placeholder="Ingrese su nueva contraseña"
                />
              </label>
              <label className="font-medium text-gray-700 col-span-2 md:col-span-2 lg:col-span-1" htmlFor="repeat_password">
                Confirmar contraseña:
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  id="repeat_password"
                  className="block border border-gray-300 rounded-md p-2 w-full"
                  placeholder="Repita la nueva contraseña"
                />
              </label>
              <button
                onClick={handleActualizarPassword}
                className="col-span-2 md:col-span-2 lg:col-span-2 w-full bg-accentLight hover:bg-accentBase transition-colors px-2 py-2 rounded-lg text-neutral"
              >
                Actualizar
              </button>
            </fieldset>
          </section>
        </div>
      </div>
    </div>
  );
}

export default CambiarPassword;
