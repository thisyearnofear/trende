#!/usr/bin/env python3
"""Quick test to verify the setup is working."""

import sys

def test_imports():
    """Test that all critical imports work."""
    print("Testing imports...")
    
    try:
        import fastapi
        print("✓ FastAPI")
    except ImportError as e:
        print(f"✗ FastAPI: {e}")
        return False
    
    try:
        import langchain
        print("✓ LangChain")
    except ImportError as e:
        print(f"✗ LangChain: {e}")
        return False
    
    try:
        import langgraph
        print("✓ LangGraph")
    except ImportError as e:
        print(f"✗ LangGraph: {e}")
        return False
    
    try:
        from backend.api.main import app
        print("✓ Backend API")
    except Exception as e:
        print(f"✗ Backend API: {e}")
        return False
    
    return True

def main():
    print("=" * 50)
    print("Trende Setup Verification")
    print("=" * 50)
    
    if test_imports():
        print("\n✓ All tests passed! Your environment is ready.")
        print("\nNext steps:")
        print("1. Configure your .env file with API keys")
        print("2. Start the backend: uvicorn backend.api.main:app --reload")
        print("3. Start the frontend: cd frontend && npm run dev")
        return 0
    else:
        print("\n✗ Some tests failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
