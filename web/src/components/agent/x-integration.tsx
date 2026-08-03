

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Twitter, Trash2, Eye, RefreshCw } from 'lucide-react';

interface XPost {
  id: string;
  x_tweet_id: string;
  x_text: string;
  image_urls?: string[];
  like_count: number;
  retweet_count: number;
  reply_count: number;
  created_at: string;
}

interface XIntegrationProps {
  agentId: string;
  xConnected: boolean;
  xUsername?: string;
}

export function XIntegration({
  agentId,
  xConnected,
  xUsername,
}: XIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [posts, setPosts] = useState<XPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('casual');
  const [includeImage, setIncludeImage] = useState(false);
  const [imageStyle, setImageStyle] = useState('modern');
  const [generatedPost, setGeneratedPost] = useState('');
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    if (xConnected) {
      fetchPosts();
    }
  }, [xConnected]);

  const connectX = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/x/auth');
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('[v0] X connection error:', error);
      alert('Failed to connect X');
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchPosts = async () => {
    try {
      setIsLoadingPosts(true);
      const response = await fetch(`/api/agents/${agentId}/x-post`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      const { posts } = await response.json();
      setPosts(posts);
    } catch (error) {
      console.error('[v0] Fetch posts error:', error);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const generateAndPost = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    try {
      setIsGenerating(true);
      const response = await fetch(`/api/agents/${agentId}/x-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sessionToken')}`,
        },
        body: JSON.stringify({
          topic,
          tone,
          includeImage,
          imageStyle,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const { post } = await response.json();
      setGeneratedPost(post.text);
      setTopic('');
      setOpenDialog(false);
      
      // Refresh posts
      await fetchPosts();
      alert('Post published successfully!');
    } catch (error) {
      console.error('[v0] Post generation error:', error);
      alert(`Failed to generate post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!xConnected) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Twitter className="w-8 h-8 text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold">Connect X (Twitter)</h3>
              <p className="text-sm text-gray-400">
                Connect your X account to auto-generate and post content using Claude AI
              </p>
            </div>
          </div>
          <Button
            onClick={connectX}
            disabled={isConnecting}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Twitter className="w-4 h-4 mr-2" />
                Connect X
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Status */}
      <Card className="p-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Twitter className="w-8 h-8 text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold">Connected to @{xUsername}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your agent can generate and post content
              </p>
            </div>
          </div>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600">
                Generate & Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Generate Post with Claude & Images</DialogTitle>
                <DialogDescription>
                  Your post will be generated by Claude AI and can include AI-generated images
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Topic</Label>
                  <Textarea
                    placeholder="What would you like to post about?"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="min-h-24"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="humorous">Humorous</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Include Image</Label>
                    <Button
                      variant={includeImage ? 'default' : 'outline'}
                      onClick={() => setIncludeImage(!includeImage)}
                      className="w-full"
                    >
                      {includeImage ? 'With Image' : 'Text Only'}
                    </Button>
                  </div>
                </div>

                {includeImage && (
                  <div>
                    <Label>Image Style</Label>
                    <Select value={imageStyle} onValueChange={setImageStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">Modern</SelectItem>
                        <SelectItem value="abstract">Abstract</SelectItem>
                        <SelectItem value="photorealistic">Photorealistic</SelectItem>
                        <SelectItem value="anime">Anime</SelectItem>
                        <SelectItem value="cyberpunk">Cyberpunk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  onClick={generateAndPost}
                  disabled={isGenerating}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating & Publishing...
                    </>
                  ) : (
                    'Generate & Publish Post'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Posts History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Posts</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPosts}
            disabled={isLoadingPosts}
          >
            {isLoadingPosts ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {posts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-400">No posts yet. Generate your first post!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="p-4">
                <div className="flex gap-4">
                  {post.image_urls && post.image_urls.length > 0 && (
                    <img
                      src={post.image_urls[0]}
                      alt="Post"
                      className="w-24 h-24 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {post.x_text}
                    </p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {post.like_count} likes
                      </div>
                      <div className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        {post.retweet_count} retweets
                      </div>
                      <div>{post.reply_count} replies</div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
