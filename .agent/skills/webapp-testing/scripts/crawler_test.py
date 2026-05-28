#!/usr/bin/env python3
import sys
import json
import os
from datetime import datetime
import tempfile

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


def run_e2e_crawler(base_url: str) -> dict:
    """Run programmatic browser crawls on all critical routes to verify page load & security auth guards."""
    if not PLAYWRIGHT_AVAILABLE:
        return {
            "status": "error",
            "error": "Playwright is not installed in the Python environment",
            "fix": "pip install playwright && playwright install chromium"
        }
    
    # Normalize base URL
    base_url = base_url.rstrip('/')
    
    report = {
        "title": "MeMude Connect - E2E Crawler & Auth Guard Verification",
        "timestamp": datetime.now().isoformat(),
        "base_url": base_url,
        "results": [],
        "summary": {}
    }
    
    # Target routes to check
    routes = [
        {"path": "", "name": "Landing/Login Page", "expected_redirect": False},
        # Administrative routes (Auth Guards testing)
        {"path": "/admin/users", "name": "Admin - User Management", "expected_redirect": True},
        {"path": "/admin/leads", "name": "Admin - Leads Page", "expected_redirect": True},
        {"path": "/admin/crm", "name": "Admin - CRM Kanban Board", "expected_redirect": True},
        {"path": "/admin/vendas", "name": "Admin - Sales Manager", "expected_redirect": True},
        {"path": "/admin/visitas", "name": "Admin - Visits Manager", "expected_redirect": True},
        {"path": "/admin/analytics", "name": "Admin - Analytics & KPIs", "expected_redirect": True},
        {"path": "/admin/configuracoes", "name": "Admin - System Settings", "expected_redirect": True},
        # Broker routes (Auth Guards testing)
        {"path": "/corretor/meus-leads", "name": "Broker - My Leads", "expected_redirect": True},
        {"path": "/corretor/minhas-comissoes", "name": "Broker - Commissions", "expected_redirect": True},
        {"path": "/corretor/perfil", "name": "Broker - Profile", "expected_redirect": True},
    ]
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            
            # Directory for E2E reports & screenshots
            reports_dir = os.path.join(tempfile.gettempdir(), "memude_connect_tests")
            os.makedirs(reports_dir, exist_ok=True)
            
            for route in routes:
                target_url = f"{base_url}{route['path']}"
                page = context.new_page()
                
                # Setup console error intercepting
                console_errors = []
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                
                # Navigate to the page
                try:
                    response = page.goto(target_url, wait_until="networkidle", timeout=15000)
                    
                    final_url = page.url
                    page_title = page.title()
                    status_code = response.status if response else 500
                    
                    # Verify redirection behavior
                    redirected = final_url != target_url
                    auth_guard_passed = True
                    
                    if route['expected_redirect']:
                        # Redirection must lead away from admin/broker path to root/login or unauthorized
                        is_redirected_to_root = final_url == base_url or final_url == f"{base_url}/" or "unauthorized" in final_url
                        if not is_redirected_to_root and not redirected:
                            auth_guard_passed = False
                    
                    # Capture screenshot of landing page
                    screenshot_path = ""
                    if route['path'] == "":
                        screenshot_path = os.path.join(reports_dir, "landing_page.png")
                        page.screenshot(path=screenshot_path, full_page=False)
                    
                    route_result = {
                        "path": route['path'],
                        "name": route['name'],
                        "status_code": status_code,
                        "final_url": final_url,
                        "title": page_title,
                        "redirected": redirected,
                        "auth_guard_verified": auth_guard_passed,
                        "console_errors": console_errors,
                        "screenshot": screenshot_path if route['path'] == "" else None
                    }
                    
                    # Check for landing page elements in login screen
                    if route['path'] == "":
                        route_result["login_form_detected"] = (
                            page.locator("input[type='email']").count() > 0 or 
                            page.locator("input[type='password']").count() > 0 or
                            page.locator("button[type='submit']").count() > 0
                        )
                    
                    report["results"].append(route_result)
                    
                except Exception as e:
                    report["results"].append({
                        "path": route['path'],
                        "name": route['name'],
                        "status_code": 500,
                        "error": str(e),
                        "auth_guard_verified": False
                    })
                finally:
                    page.close()
            
            browser.close()
            
            # Aggregate stats
            passed_checks = sum(1 for r in report["results"] if r.get("auth_guard_verified", False) and not r.get("error"))
            total_checks = len(routes)
            
            report["summary"] = {
                "total_routes_checked": total_checks,
                "passed": passed_checks,
                "failed": total_checks - passed_checks,
                "screenshots_directory": reports_dir,
                "outcome": "SUCCESS" if passed_checks == total_checks else "FAILURE"
            }
            
    except Exception as global_err:
        report["status"] = "error"
        report["error"] = str(global_err)
        
    return report


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: python crawler_test.py <base_url>",
            "example": "python crawler_test.py https://core.memudecore.com.br"
        }, indent=2))
        sys.exit(1)
        
    url = sys.argv[1]
    results = run_e2e_crawler(url)
    print(json.dumps(results, indent=2))
