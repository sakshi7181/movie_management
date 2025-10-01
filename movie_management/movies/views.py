from django.shortcuts import render
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Movie
from .forms import MovieForm

# List all movies for the logged-in user
@login_required
def movie_list(request):
    movies = Movie.objects.filter(created_by=request.user)
    return render(request, 'movies/movie_list.html', {'movies': movies})

# Create a new movie
@login_required
def movie_create(request):
    if request.method == 'POST':
        form = MovieForm(request.POST, request.FILES)  # <-- include request.FILES for images
        if form.is_valid():
            movie = form.save(commit=False)
            movie.created_by = request.user
            movie.save()
            return redirect('movie_list')
    else:
        form = MovieForm()
    return render(request, 'movies/movie_form.html', {'form': form})

# Update an existing movie
@login_required
def movie_update(request, pk):
    movie = get_object_or_404(Movie, pk=pk, created_by=request.user)
    if request.method == 'POST':
        form = MovieForm(request.POST, request.FILES, instance=movie)
        if form.is_valid():
            form.save()
            return redirect('movie_list')
    else:
        form = MovieForm(instance=movie)
    return render(request, 'movies/movie_form.html', {'form': form})

# Delete a movie
@login_required
def movie_delete(request, pk):
    movie = get_object_or_404(Movie, pk=pk, created_by=request.user)
    if request.method == 'POST':
        movie.delete()
        return redirect('movie_list')
    return render(request, 'movies/movie_confirm_delete.html', {'movie': movie})

# Create your views here.
