"""
Authentication Module for SignalForge

This module handles Clerk JWT authentication and user management.
"""

import jwt
import requests
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import logging

from config import settings
from exceptions import AuthenticationError, AuthorizationError, ConfigurationError

logger = logging.getLogger(__name__)


class ClerkUser(BaseModel):
    """Clerk user information."""
    
    id: str
    email: Optional[str] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[int] = None
    updated_at: Optional[int] = None
    
    @property
    def display_name(self) -> str:
        """Get display name for the user."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.username:
            return self.username
        elif self.email:
            return self.email.split('@')[0]
        else:
            return f"User {self.id}"


class JWTVerifier:
    """JWT token verifier for Clerk authentication."""
    
    def __init__(self):
        self.issuer = settings.CLERK_JWT_ISSUER
        self.public_key = settings.CLERK_JWT_PUBLIC_KEY
        
        if not self.issuer or not self.public_key:
            if settings.is_production:
                raise ConfigurationError("Clerk JWT configuration missing in production")
            else:
                logger.warning("Clerk JWT configuration missing - authentication disabled")
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify JWT token and return payload.
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded token payload
            
        Raises:
            AuthenticationError: If token is invalid
        """
        if not self.issuer or not self.public_key:
            raise AuthenticationError("Authentication not configured")
        
        try:
            # Decode and verify token
            payload = jwt.decode(
                token,
                self.public_key,
                algorithms=["RS256"],
                issuer=self.issuer,
                options={
                    "verify_signature": True,
                    "verify_iss": True,
                    "verify_aud": False,  # Clerk doesn't use audience
                    "verify_exp": True,
                    "verify_iat": True,
                }
            )
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationError(f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"JWT verification error: {str(e)}")
            raise AuthenticationError("Token verification failed")
    
    def get_user_from_token(self, token: str) -> ClerkUser:
        """
        Extract user information from verified token.
        
        Args:
            token: Verified JWT token payload
            
        Returns:
            ClerkUser object
        """
        payload = self.verify_token(token)
        
        # Extract user information from payload
        user_data = payload.get("sub", {})
        
        return ClerkUser(
            id=user_data.get("user_id", ""),
            email=user_data.get("email"),
            username=user_data.get("username"),
            first_name=user_data.get("first_name"),
            last_name=user_data.get("last_name"),
            image_url=user_data.get("image_url"),
            created_at=user_data.get("created_at"),
            updated_at=user_data.get("updated_at")
        )


# Global JWT verifier
jwt_verifier = None


def get_jwt_verifier() -> JWTVerifier:
    """Get or create JWT verifier instance."""
    global jwt_verifier
    if jwt_verifier is None:
        jwt_verifier = JWTVerifier()
    return jwt_verifier


# HTTP Bearer scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    request: Request = None
) -> Optional[ClerkUser]:
    """
    Get current user from JWT token.
    
    Args:
        credentials: HTTP Authorization credentials
        request: FastAPI request object
        
    Returns:
        ClerkUser object or None if no token provided
        
    Raises:
        AuthenticationError: If token is invalid
    """
    # Skip authentication if not configured
    if not settings.CLERK_JWT_ISSUER or not settings.CLERK_JWT_PUBLIC_KEY:
        if settings.is_production:
            raise AuthenticationError("Authentication required but not configured")
        else:
            logger.debug("Authentication skipped - not configured")
            return None
    
    # Check if token provided
    if not credentials:
        return None
    
    try:
        verifier = get_jwt_verifier()
        user = verifier.get_user_from_token(credentials.credentials)
        
        logger.debug(f"Authenticated user: {user.id}")
        return user
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise AuthenticationError("Authentication failed")


async def require_auth(
    user: Optional[ClerkUser] = Depends(get_current_user)
) -> ClerkUser:
    """
    Require authentication for protected routes.
    
    Args:
        user: Current user from get_current_user
        
    Returns:
        ClerkUser object
        
    Raises:
        AuthenticationError: If user is not authenticated
        AuthorizationError: If authentication is not configured
    """
    if not settings.CLERK_JWT_ISSUER or not settings.CLERK_JWT_PUBLIC_KEY:
        raise AuthorizationError("Authentication not configured")
    
    if not user:
        raise AuthenticationError("Authentication required")
    
    return user


def is_user_authorized(user: ClerkUser, required_permissions: Optional[list] = None) -> bool:
    """
    Check if user has required permissions.
    
    Args:
        user: Current user
        required_permissions: List of required permissions (future enhancement)
        
    Returns:
        True if user is authorized
    """
    # For now, all authenticated users are authorized
    # Future: implement role-based permissions
    return user is not None


async def require_permissions(required_permissions: list):
    """
    Dependency for requiring specific permissions.
    
    Args:
        required_permissions: List of required permissions
        
    Returns:
        Dependency function
    """
    async def permission_dependency(
        user: ClerkUser = Depends(require_auth)
    ) -> ClerkUser:
        if not is_user_authorized(user, required_permissions):
            raise AuthorizationError("Insufficient permissions")
        return user
    
    return permission_dependency


# Clerk API integration (optional)
class ClerkAPI:
    """Clerk API client for user management."""
    
    def __init__(self):
        self.api_key = settings.CLERK_API_KEY
        self.base_url = "https://api.clerk.dev/v1"
        
        if not self.api_key:
            logger.warning("Clerk API key not configured")
    
    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user information from Clerk API.
        
        Args:
            user_id: Clerk user ID
            
        Returns:
            User information or None if not found
        """
        if not self.api_key:
            return None
        
        try:
            response = requests.get(
                f"{self.base_url}/users/{user_id}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Clerk API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Clerk API request failed: {str(e)}")
            return None
    
    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update user information in Clerk.
        
        Args:
            user_id: Clerk user ID
            update_data: Data to update
            
        Returns:
            Updated user information or None if failed
        """
        if not self.api_key:
            return None
        
        try:
            response = requests.patch(
                f"{self.base_url}/users/{user_id}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=update_data
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Clerk API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Clerk API request failed: {str(e)}")
            return None


# Global Clerk API instance
clerk_api = ClerkAPI() if settings.CLERK_API_KEY else None
