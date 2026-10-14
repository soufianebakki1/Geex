using Microsoft.AspNetCore.Mvc;

namespace Geex.Controllers
{
	public class AppController : Controller
	{
		public IActionResult Todo()
		{
			return View();
		}
		
		public IActionResult Chat()
		{
			return View();
		}

		public IActionResult Calender()
		{
			return View();
		}
	}
}
