'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, loading, error } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    mt_id: '',
    mt_pwd: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (isLoggedIn && !loading) {
      router.push('/');
    }
  }, [isLoggedIn, loading, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.mt_id || !formData.mt_pwd) {
      toast({
        title: '입력 오류',
        description: '아이디와 비밀번호를 모두 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await login(formData);
      toast({
        title: '로그인 성공',
        description: '환영합니다!',
      });
      router.push('/');
    } catch (error: any) {
      toast({
        title: '로그인 실패',
        description: error.message || '로그인에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
        <LoadingSpinner 
          message="인증 상태를 확인하는 중입니다..." 
          fullScreen={false}
          type="ripple"
          size="md"
          color="indigo"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">로그인</CardTitle>
          <CardDescription>
            SMAP 계정으로 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mt_id">아이디 (전화번호)</Label>
              <Input
                id="mt_id"
                name="mt_id"
                type="text"
                placeholder="전화번호를 입력하세요"
                value={formData.mt_id}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mt_pwd">비밀번호</Label>
              <Input
                id="mt_pwd"
                name="mt_pwd"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={formData.mt_pwd}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  또는
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  toast({
                    title: '준비 중',
                    description: '소셜 로그인은 준비 중입니다.',
                  });
                }}
              >
                카카오로 로그인
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  toast({
                    title: '준비 중',
                    description: '소셜 로그인은 준비 중입니다.',
                  });
                }}
              >
                구글로 로그인
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 