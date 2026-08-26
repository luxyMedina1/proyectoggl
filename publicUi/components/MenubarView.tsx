import { NavLink } from '@/utils/nextRouterCompat'


const itemsMenu: any[] = [
    { path: 'home', icon: '', label: 'Home' },
    { path: 'home/test', icon: '', label: 'Test' },
    { path: 'home/about', icon: '', label: 'About' }
]

export const MenubarView = () => {
  return (
    <>
      <aside id="separator-sidebar" 
      className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0" aria-label="Sidebar">
        <div className="h-full px-3 py-4 overflow-y-auto text-white bg-slate-800 dark:bg-slate-800">
          <ul className="space-y-2 font-medium">
            <li className="flex">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            </li>
          </ul>
          <ul className="space-y-2 font-medium mt-2">            
            {
                itemsMenu.map((item, index) => (
                    <li key={index}>
                    <NavLink to={`/${item.path}`} className="flex items-center p-2 text-slate-100 rounded-lg dark:text-white hover:bg-slate-600 dark:hover:bg-slate-700 group">
                        <i className="fa-solid fa-table-columns"></i>
                        <span className="ms-3">{item.label}</span>
                    </NavLink>
                    </li>
                ))
            }
          </ul>
        </div>
      </aside>
    </>
  )
}